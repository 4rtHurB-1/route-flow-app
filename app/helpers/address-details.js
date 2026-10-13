import { helper } from '@ember/component/helper';

// function parseDetails(text) {
//     const parts = text.split(';').map((part) => part.trim());

//     const pension = parts.find((part) => /^Пенсія/i.test(part));
//     const pensionDay = pension?.match(/\((\d+)\)/)?.[1];

//     const isPension = Boolean(pension),
//         hasMagazine = parts.some((part) => /^Газети$/i.test(part)),
//         note = parts.filter((part) => !/^Пенсія/i.test(part) && !/^Газети$/i.test(part)).join('; ');

//     return {
//         isPension: isPension,
//         pensionDay: pensionDay ? Number(pensionDay) : null,
//         hasMagazine: hasMagazine,
//         isBlacklist: !isPension && !hasMagazine,
//         note: note,
//     };
// }


function parseDetails(text = '') {
  const parts = text.split(';').map(part => part.trim()).filter(Boolean);

  const pension = parts.find(part => /^Пенсія(?=\s|\(|,|$)/i.test(part));

  const pensionDay = pension?.match(/\((\d+)\)/)?.[1];

  const pensionNote = pension
    ? pension.replace(/^Пенсія\s*(?:\(\d+\))?\s*,?\s*/i, '').trim()
    : '';

  const blacklistParts = parts.filter(part =>
    !/^Пенсія(?=\s|\(|,|$)/i.test(part) &&
    !/^Газети$/i.test(part)
  );

  return {
    isPension: Boolean(pension),
    pensionDay: pensionDay ? Number(pensionDay) : null,
    pensionNote,
    hasMagazine: parts.some(part => /^Газети$/i.test(part)),
    isBlacklist: blacklistParts.length > 0,
    blacklistNote: blacklistParts.join('; ')
  };
}

export default helper(function isLast([reason]) {
    return parseDetails(reason);
});
