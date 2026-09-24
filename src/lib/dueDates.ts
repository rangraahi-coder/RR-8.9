export function isoDate(value:string):string{
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const m=value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
function timestamp(value:string){const s=isoDate(value),n=Date.parse(s+'T00:00:00Z');return s&&Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n:NaN;}
export function dueDateFromDays(date:string,days:string):string{
 if(!/^\d+$/.test(days)||Number(days)>36500)return '';
 const n=timestamp(date);return Number.isFinite(n)?new Date(n+Number(days)*86400000).toISOString().slice(0,10):'';
}
export function daysUntilDue(date:string,due:string):string{
 const n=(timestamp(due)-timestamp(date))/86400000;return Number.isInteger(n)&&n>=0?String(n):'';
}
