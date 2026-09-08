# KurtiERP — original workflow with the current UI

यह पूरा Next.js project है। Rocket में code paste करने की जरूरत नहीं है। सबसे पहली supplied app का active workflow आधार है; dark sidebar / pink-white UI और restored forms साथ रखे गए हैं।

## शुरू करने के 3 काम

1. **Supabase:** अपने उसी existing ERP project के SQL Editor में `DATABASE-UPDATE.sql` का पूरा text paste करके Run करें। पहले किया हुआ Original Item Master update मौजूद हो तो script उसे दोबारा create नहीं करेगी। सफल result: `KurtiERP update applied. Existing business data retained.` Run होने से database changes save हो जाते हैं; अलग से Save दबाने की जरूरत नहीं। यह empty database बनाने की script नहीं है। पुराने reset/seed migrations चलाने की जरूरत नहीं।
2. **Vercel configuration:** उसी Supabase project के `NEXT_PUBLIC_SUPABASE_URL` और `NEXT_PUBLIC_SUPABASE_ANON_KEY` Vercel project की Environment Variables में जोड़ें। अपनी असली values लगाएँ। Keys इस ZIP में शामिल नहीं हैं। Build के समय ये variables उपलब्ध होने चाहिए; बदलने पर redeploy करें। Framework Next.js, Install `npm ci`, Build `npm run build`।
3. **Deploy:** ZIP extract करके `KurtiERP-Restored` folder deploy करें—वही folder जिसमें `package.json` है। Vercel Drop folder स्वीकार करता है; existing project के लिए Git/CLI भी उपलब्ध हैं। अगर पहली Drop build variables न होने से fail हो, project settings में variables डालकर redeploy करें।

[Vercel deployment documentation](https://vercel.com/docs/deployments) · [Environment variables](https://vercel.com/docs/environment-variables)

## Remaining component से नया item

Contractor Finishing → **Component Assembly** tab → **New Item from Component**.

Source Job Card, component/size/colour चुनें → नया item name/code और quantity डालें → Create New Item & Convert Stock.

उदाहरण: 12 Kurta, 10 Pant, 10 Dupatta से 10 ready sets बनते हैं। बाकी 2 Kurta component stock में रहते हैं। इन्हें नया नाम/code देकर 2 अलग 1PC ready items में convert कर सकते हैं। Conversion voucher का prefix `CCV-` है। नया item Item Master, Sales item choices और Finished Goods/Dispatch में linked है। उपलब्ध colour/size को मनमाने ढंग से बदलने की अनुमति नहीं; source colour गायब हो तो actual colour भरें। दूसरे details/image बाद में Item Master में जोड़ सकते हैं।

Conversion स्वयं नहीं चलता। सिर्फ चुनी गई quantity consume होती है। Stock से ज्यादा conversion blocked है। Connection टूटे तो **Recover last conversion** इस्तेमाल करें। Dispatch हो जाने के बाद conversion delete नहीं होगा। Undispatched conversion reverse करने पर source components उपलब्ध होते हैं; नया master item catalog में रहता है।

## Ready set का नियम

Item Master composition ही तय करती है कि हर set में कितने Kurta/Pant/Dupatta चाहिए। Assembly में `Fill complete sets` उपलब्ध components के हिसाब से पूरी sets की quantity भरता है। बचा stock नहीं काटता। एक assembly voucher एक size/colour के लिए है। Required composition/Job Card linking missing हो तो पहले master ठीक करें—app अनुमान लगाकर ready set नहीं बनाएगी।

Finishing Entry का component save अब stock में post होता है। उसके finished size quantities का total Final Count के बराबर होना चाहिए। QC से approved total से ज्यादा component finishing blocked है। पुराने aggregate-only Workflow entries में component breakdown नहीं है, इसलिए उन्हें guessed component stock में नहीं बदलता। Historical rows को इस update ने backfill/recalculate नहीं किया है।

## Deploy के बाद अपने account से जाँचें

- Login → Settings → Diagnostics: session और table reads देखें।
- Item Master में original image, measurement sheet, colour, composition और detail controls देखें।
- अपने real voucher को save/reload करके persistence जाँचें। कोई demo entry इस package ने नहीं डाली है।
- दो tabs में update करें और balance refresh देखें। Realtime unavailable हो तो focus/reconnect और visible-tab polling fallback है।
- Existing Supabase Storage `item-images` bucket और उसके upload/read permissions जरूरी हैं। Existing auth/RLS policies का पालन होता है; app service-role key इस्तेमाल नहीं करती।

## Local development

Node 22.x (locked Supabase dependency requirement). Project folder में `.env.example` से `.env.local` बनाएँ और अपनी project values लगाएँ।

```sh
npm ci
npm run dev
```

Local verification:

```sh
npm run type-check
npm run lint
npm run build
npm --prefix verification install
npm --prefix verification test
```

`verification` tests isolated local PostgreSQL/PGlite fixtures इस्तेमाल करते हैं; आपके Supabase data में entries नहीं बनाते।

## Verification सीमा

यह source-based restoration और local verification वाला package है। Live Supabase schema/RLS/storage, actual login/navigation, visual browser comparison और हर production voucher की end-to-end save verification यहाँ नहीं हो सकी। `FIXES-AND-VERIFICATION.md` में fixes और remaining limitations स्पष्ट हैं।
