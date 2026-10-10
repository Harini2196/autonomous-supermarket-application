export function stockSignals({stock,forecast,averageSales,day}) {
 return {condition:stock===0?'sold_out':stock<=Math.ceil(1.5*forecast)?'low_stock':null,slow:day>=7&&stock>Math.max(10,14*averageSales)};
}
export function affordableQuantity(wanted,cash,unitCost) {
 if(wanted<0||cash<0||unitCost<=0)throw Error('Invalid purchasing inputs');
 return Math.min(wanted,Math.floor(cash/unitCost));
}
