'use server';

import { createClient } from '@/lib/supabase/server';
import {
  parseRangraahiWIP,
  generateDetailLineKey,
  ParsedVariantBlock,
  ParsedStyleGroup,
} from './itemImportParser';

export interface ImportPreviewResult {
  totalBlocks: number;
  existingVariantsMatched: number;
  existingParentsMatched: number;
  newVariantsToCreate: number;
  newParentsToCreate: number;
  imagesDetected: number;
  imagesReused: number;
  materialLinesDetected: number;
  reviewRequired: number;
  missingQuantities: number;
  ambiguousMatches: number;
  invalidRows: number;
  styleGroups: Array<{
    jobCardNo: string;
    importKey: string;
    existingStyleId: string | null;
    matchLevel: string;
    variants: Array<{
      importKey: string;
      colour: string;
      colourNormalized: string;
      existingVariantId: string | null;
      matchLevel: string;
      detailLinesCount: number;
      reviewCount: number;
    }>;
  }>;
  warnings: string[];
}

export interface ImportFinalResult {
  batchId: string;
  itemsLinked: number;
  itemsUpdated: number;
  parentsCreated: number;
  variantsCreated: number;
  imagesLinked: number;
  bomLinesCreated: number;
  bomLinesUpdated: number;
  recordsSkipped: number;
  errors: string[];
  reviewRequired: number;
}

// ─── Preview (dry-run) ────────────────────────────────────────────────────────

export async function previewItemImport(): Promise<ImportPreviewResult> {
  const supabase = await createClient();
  const parsed = parseRangraahiWIP();

  let existingVariantsMatched = 0;
  let existingParentsMatched = 0;
  let newVariantsToCreate = 0;
  let newParentsToCreate = 0;
  const warnings: string[] = [...parsed.warnings];

  const previewGroups: ImportPreviewResult['styleGroups'] = [];

  for (const styleGroup of parsed.styleGroups) {
    // Check if a job_card with this job_card_no exists
    const { data: existingJC } = await supabase
      .from('job_cards')
      .select('id, job_card_no, colors')
      .eq('job_card_no', styleGroup.jobCardNo)
      .maybeSingle();

    // Check if item_style already exists
    const { data: existingStyle } = await supabase
      .from('item_styles')
      .select('id')
      .eq('import_key', styleGroup.importKey)
      .maybeSingle();

    const styleExists = !!existingStyle;
    if (styleExists) {
      existingParentsMatched++;
    } else if (existingJC) {
      existingParentsMatched++;
    } else {
      newParentsToCreate++;
    }

    const variantPreviews: ImportPreviewResult['styleGroups'][0]['variants'] = [];

    for (const variant of styleGroup.variants) {
      const { data: existingVariant } = await supabase
        .from('item_variants')
        .select('id')
        .eq('import_key', variant.importKey)
        .maybeSingle();

      let matchLevel = 'new_record';
      let existingVariantId: string | null = null;

      if (existingVariant) {
        matchLevel = 'exact_variant';
        existingVariantId = existingVariant.id;
        existingVariantsMatched++;
      } else if (existingJC) {
        // Check if this colour exists in job card colors
        const jcColors: string[] = existingJC.colors || [];
        const colourMatch = jcColors.some(
          (c) => c.toUpperCase() === variant.colourNormalized
        );
        if (colourMatch) {
          matchLevel = 'parent_match';
          existingParentsMatched++;
        } else {
          matchLevel = 'parent_match';
          newVariantsToCreate++;
        }
      } else {
        newVariantsToCreate++;
      }

      const reviewCount = variant.detailLines.filter(
        (l) => l.reviewStatus !== 'ok'
      ).length;

      variantPreviews.push({
        importKey: variant.importKey,
        colour: variant.colour,
        colourNormalized: variant.colourNormalized,
        existingVariantId,
        matchLevel,
        detailLinesCount: variant.detailLines.length,
        reviewCount,
      });
    }

    previewGroups.push({
      jobCardNo: styleGroup.jobCardNo,
      importKey: styleGroup.importKey,
      existingStyleId: existingStyle?.id || null,
      matchLevel: styleExists ? 'exact_variant' : existingJC ? 'parent_match' : 'new_record',
      variants: variantPreviews,
    });
  }

  return {
    totalBlocks: parsed.totalBlocks,
    existingVariantsMatched,
    existingParentsMatched,
    newVariantsToCreate,
    newParentsToCreate,
    imagesDetected: 0, // Images not embedded in this file per document analysis
    imagesReused: 0,
    materialLinesDetected: parsed.totalDetailLines,
    reviewRequired: parsed.reviewRequired,
    missingQuantities: parsed.missingQuantities,
    ambiguousMatches: 0,
    invalidRows: 0,
    styleGroups: previewGroups,
    warnings,
  };
}

// ─── Execute Import ───────────────────────────────────────────────────────────

export async function executeItemImport(): Promise<ImportFinalResult> {
  const supabase = await createClient();
  const parsed = parseRangraahiWIP();

  const errors: string[] = [];
  let itemsLinked = 0;
  let itemsUpdated = 0;
  let parentsCreated = 0;
  let variantsCreated = 0;
  let bomLinesCreated = 0;
  let bomLinesUpdated = 0;
  let recordsSkipped = 0;
  let reviewRequired = 0;

  // Create import batch record
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      source_file: 'RANGRAAHI WIP.xlsx',
      batch_key: `RANGRAAHI_WIP_${Date.now()}`,
      total_blocks: parsed.totalBlocks,
      status: 'processing',
    })
    .select('id')
    .single();

  if (batchErr || !batch) {
    return {
      batchId: '',
      itemsLinked: 0,
      itemsUpdated: 0,
      parentsCreated: 0,
      variantsCreated: 0,
      imagesLinked: 0,
      bomLinesCreated: 0,
      bomLinesUpdated: 0,
      recordsSkipped: 0,
      errors: [`Failed to create import batch: ${batchErr?.message}`],
      reviewRequired: 0,
    };
  }

  const batchId = batch.id;

  for (const styleGroup of parsed.styleGroups) {
    try {
      const styleId = await upsertStyle(supabase, styleGroup, batchId);
      if (!styleId) {
        errors.push(`Failed to upsert style for JC ${styleGroup.jobCardNo}`);
        continue;
      }

      // Check if this was created or linked
      const { data: existingStyleCheck } = await supabase
        .from('item_styles')
        .select('created_at, updated_at')
        .eq('id', styleId)
        .single();

      if (existingStyleCheck) {
        const wasJustCreated =
          Math.abs(
            new Date(existingStyleCheck.created_at).getTime() - Date.now()
          ) < 5000;
        if (wasJustCreated) parentsCreated++;
        else itemsLinked++;
      }

      for (const variant of styleGroup.variants) {
        try {
          const { variantId, wasCreated } = await upsertVariant(
            supabase,
            variant,
            styleId,
            batchId
          );

          if (!variantId) {
            errors.push(
              `Failed to upsert variant ${variant.importKey}`
            );
            continue;
          }

          if (wasCreated) variantsCreated++;
          else itemsUpdated++;

          // Upsert detail lines
          for (const line of variant.detailLines) {
            try {
              const lineKey = generateDetailLineKey(
                variant.importKey,
                line.materialNameNormalized,
                line.quantity,
                line.unit,
                line.sourceText
              );

              const { data: existingLine } = await supabase
                .from('item_detail_lines')
                .select('id')
                .eq('import_key', lineKey)
                .maybeSingle();

              if (existingLine) {
                // Update existing
                await supabase
                  .from('item_detail_lines')
                  .update({
                    category: line.category,
                    material_name: line.materialName,
                    material_name_normalized: line.materialNameNormalized,
                    quantity: line.quantity,
                    unit: line.unit,
                    secondary_quantity: line.secondaryQuantity,
                    secondary_unit: line.secondaryUnit,
                    notes: line.notes,
                    source_text: line.sourceText,
                    source_row: line.sourceRow,
                    review_status: line.reviewStatus,
                    review_note: line.reviewNote,
                    import_batch_id: batchId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existingLine.id);
                bomLinesUpdated++;
              } else {
                // Insert new
                await supabase.from('item_detail_lines').insert({
                  variant_id: variantId,
                  category: line.category,
                  material_name: line.materialName,
                  material_name_normalized: line.materialNameNormalized,
                  quantity: line.quantity,
                  unit: line.unit,
                  secondary_quantity: line.secondaryQuantity,
                  secondary_unit: line.secondaryUnit,
                  notes: line.notes,
                  source_text: line.sourceText,
                  source_row: line.sourceRow,
                  review_status: line.reviewStatus,
                  review_note: line.reviewNote,
                  import_key: lineKey,
                  import_batch_id: batchId,
                });
                bomLinesCreated++;
              }

              if (line.reviewStatus !== 'ok') reviewRequired++;
            } catch (lineErr: unknown) {
              errors.push(
                `Detail line error for ${variant.importKey}: ${lineErr instanceof Error ? lineErr.message : String(lineErr)}`
              );
            }
          }

          // Audit log entry
          await supabase.from('import_audit_log').insert({
            import_batch_id: batchId,
            entity_type: 'item_variant',
            entity_id: variantId,
            action: wasCreated ? 'created' : 'updated',
            source_file: 'RANGRAAHI WIP.xlsx',
            notes: `JC ${variant.jobCardNo} / ${variant.colour}`,
          });
        } catch (varErr: unknown) {
          errors.push(
            `Variant error ${variant.importKey}: ${varErr instanceof Error ? varErr.message : String(varErr)}`
          );
        }
      }
    } catch (styleErr: unknown) {
      errors.push(
        `Style error JC ${styleGroup.jobCardNo}: ${styleErr instanceof Error ? styleErr.message : String(styleErr)}`
      );
    }
  }

  // Update batch with final counts
  await supabase
    .from('import_batches')
    .update({
      matched_variants: itemsLinked,
      new_variants: variantsCreated,
      new_parents: parentsCreated,
      material_lines: bomLinesCreated + bomLinesUpdated,
      review_required: reviewRequired,
      errors: errors.length,
      status: errors.length === 0 ? 'completed' : 'completed_with_errors',
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  return {
    batchId,
    itemsLinked,
    itemsUpdated,
    parentsCreated,
    variantsCreated,
    imagesLinked: 0,
    bomLinesCreated,
    bomLinesUpdated,
    recordsSkipped,
    errors,
    reviewRequired,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertStyle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  styleGroup: ParsedStyleGroup,
  batchId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('item_styles')
    .select('id')
    .eq('import_key', styleGroup.importKey)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('item_styles')
      .update({
        style_no: styleGroup.styleNo,
        set_type: styleGroup.setType,
        updated_at: new Date().toISOString(),
        import_batch_id: batchId,
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: jc } = await supabase
    .from('job_cards')
    .select('id')
    .eq('job_card_no', styleGroup.jobCardNo)
    .maybeSingle();

  const { data: newStyle, error } = await supabase
    .from('item_styles')
    .insert({
      job_card_no: styleGroup.jobCardNo,
      design_code: styleGroup.styleNo || styleGroup.jobCardNo,
      style_no: styleGroup.styleNo,
      set_type: styleGroup.setType,
      linked_job_card_id: jc?.id || null,
      source_file: 'RANGRAAHI WIP.xlsx',
      import_batch_id: batchId,
      import_key: styleGroup.importKey,
    })
    .select('id')
    .single();

  if (error) return null;
  return newStyle.id;
}

async function upsertVariant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  variant: ParsedVariantBlock,
  styleId: string,
  batchId: string
): Promise<{ variantId: string | null; wasCreated: boolean }> {
  const { data: existing } = await supabase
    .from('item_variants')
    .select('id')
    .eq('import_key', variant.importKey)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('item_variants')
      .update({
        style_no: variant.styleNo,
        set_type: variant.setType,
        updated_at: new Date().toISOString(),
        import_batch_id: batchId,
        variant_status: 'linked',
        match_level: 'exact_variant',
        ...(variant.imageUrl ? { variant_image_url: variant.imageUrl } : {}),
      })
      .eq('id', existing.id);
    return { variantId: existing.id, wasCreated: false };
  }

  const { data: jc } = await supabase
    .from('job_cards')
    .select('id')
    .eq('job_card_no', variant.jobCardNo)
    .maybeSingle();

  const { data: newVariant, error } = await supabase
    .from('item_variants')
    .insert({
      style_id: styleId,
      job_card_no: variant.jobCardNo,
      style_no: variant.styleNo,
      set_type: variant.setType,
      colour: variant.colour,
      colour_normalized: variant.colourNormalized,
      linked_job_card_id: jc?.id || null,
      variant_status: jc ? 'linked' : 'created',
      match_level: jc ? 'parent_match' : 'new_record',
      import_key: variant.importKey,
      source_row_start: variant.sourceRowStart,
      source_row_end: variant.sourceRowEnd,
      import_source: 'RANGRAAHI WIP.xlsx',
      import_batch_id: batchId,
      variant_image_url: variant.imageUrl || '',
    })
    .select('id')
    .single();

  if (error) return { variantId: null, wasCreated: false };
  return { variantId: newVariant.id, wasCreated: true };
}

// ─── Fetch imported data for display ─────────────────────────────────────────

export async function getImportedVariants(jobCardNo?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('item_variants')
    .select(`
      *,
      item_styles (
        id, job_card_no, design_code, item_name, linked_job_card_id, import_key
      ),
      item_detail_lines (
        id, category, material_name, material_name_normalized,
        quantity, unit, secondary_quantity, secondary_unit,
        notes, source_text, source_row, review_status, review_note, import_key
      )
    `)
    .order('job_card_no', { ascending: true });

  if (jobCardNo) {
    query = query.eq('job_card_no', jobCardNo);
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function getImportBatches() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}
