export function parseSize(value) {
  const match = value.normalize("NFKC").trim().match(/^(\d{1,4}(?:[.]\d{1,2})?)\s*(?:mm|毫米)?\s*[x×*✕]\s*(\d{1,5}(?:[.]\d{1,2})?)\s*(?:mm|毫米)?$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const length = Number(match[2]);
  return width > 0 && length > 0 ? width + "x" + length : null;
}

export function displaySize(size) {
  return size.replace("x", " × ");
}

function normalizeQuery(value) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/\band\b/g, "").replace(/[\s+&-]/g, "");
}

export function filterRecords(records, { size, brand, type, query, status }) {
  const modelQuery = normalizeQuery(query);
  return records.filter(record =>
    (!size || record.size === size)
    && (!brand || record.brand === brand)
    && (!type || record.type === type)
    && (!status || record.status === status)
    && (!modelQuery || normalizeQuery([record.brand, record.model, record.aliases].join(" ")).includes(modelQuery))
  );
}
