import {DateTime} from 'luxon';
export const zone='America/New_York';
export const day=(value:string)=>DateTime.fromISO(value).setZone(zone).toFormat('ccc, LLL d');
export const clock=(value:string)=>DateTime.fromISO(value).setZone(zone).toFormat('h:mm a');
export const fullTime=(value:string)=>DateTime.fromISO(value).setZone(zone).toFormat('ccc, LLL d · h:mm a ZZZZ');
export function resolveLocalTime(value:string): {iso:string;label:string}[] {
 const date=DateTime.fromISO(value,{zone});
 if(!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm")!==value) return [];
 return date.getPossibleOffsets().map(d=>({iso:d.toISO()!,label:d.toFormat('h:mm a ZZZZ (ZZ)')}));
}
