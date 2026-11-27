import { records, sizes, statuses, types } from "./catalog.js";
import { displaySize, filterRecords, parseSize } from "./filter.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const brands = [...new Set(records.map(record => record.brand))].sort((left, right) => left.localeCompare(right, "en"));
const ranking = { confirmed: 0, nominal: 1, pending: 2 };
const catalog = [...records].sort((left, right) => ranking[left.status] - ranking[right.status]
  || sizes.indexOf(left.size) - sizes.indexOf(right.size));
const totals = Object.fromEntries(Object.keys(statuses).map(status =>
  [status, records.filter(record => record.status === status).length]
));
const params = new URLSearchParams(location.search);
const initialSize = params.get("size");
const state = {
  size: initialSize === "all" ? "" : parseSize(initialSize || "") || sizes[0],
  brand: brands.includes(params.get("brand")) ? params.get("brand") : "",
  type: Object.hasOwn(types, params.get("type")) ? params.get("type") : "",
  status: Object.hasOwn(statuses, params.get("status")) ? params.get("status") : "",
  query: (params.get("q") || "").slice(0, 100),
  view: params.get("view") === "pending" && params.get("status") === "pending" ? "pending" : "catalog",
};

const sizeInput = $("#size-input");
const sizeError = $("#size-error");
const sizeSelect = $("#size-select");
const modelInput = $("#model-input");
const brandFilter = $("#brand-filter");
const typeFilter = $("#type-filter");
const dialog = $("#detail-dialog");
const dialogContent = $("#dialog-content");
const results = $("#results");
const resetButton = $("#reset");
const sizeCount = new Map(sizes.map(size => [size, records.filter(record => record.size === size).length]));

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function fillSelect(select, label, options) {
  select.replaceChildren(new Option(label, ""), ...options.map(([value, text]) => new Option(text, value)));
}

function showSizeError(message = "") {
  sizeError.textContent = message;
  sizeError.hidden = !message;
  sizeInput.setAttribute("aria-invalid", message ? "true" : "false");
}

function setSize(size) {
  state.size = size;
  sizeInput.value = size ? displaySize(size) : "";
  showSizeError();
  render();
}

function clearFilters() {
  Object.assign(state, { size: "", brand: "", type: "", status: "", query: "", view: "catalog" });
  modelInput.value = "";
  setSize("");
}

function sizeOption(size, count) {
  const button = element("button", "", "size-option");
  button.type = "button";
  button.dataset.size = size;
  button.append(element(size ? "b" : "span", size ? displaySize(size) : "全部尺寸"), element("small", String(count)));
  button.setAttribute("aria-label", size ? displaySize(size) + " mm" : "全部尺寸");
  button.addEventListener("click", () => setSize(size));
  return button;
}

function statusOption(status, title) {
  const button = element("button", title, "status-filter");
  button.type = "button";
  button.dataset.status = status;
  button.append(element("small", "0"));
  button.addEventListener("click", () => {
    state.status = status;
    if (status !== "pending") state.view = "catalog";
    render();
  });
  return button;
}

function syncUrl() {
  const next = new URLSearchParams();
  if (state.size !== sizes[0]) next.set("size", state.size || "all");
  if (state.brand) next.set("brand", state.brand);
  if (state.type) next.set("type", state.type);
  if (state.status) next.set("status", state.status);
  if (state.query.trim()) next.set("q", state.query.trim());
  if (state.view === "pending") next.set("view", state.view);

  const query = next.toString();
  const nextUrl = location.pathname + (query ? "?" + query : "") + location.hash;
  if (nextUrl !== location.pathname + location.search + location.hash) {
    history.replaceState(null, "", nextUrl);
  }
}

function badge(status, node = element("span")) {
  node.className = "status-badge " + status;
  node.textContent = statuses[status];
  return node;
}

function showEvidence(record) {
  const title = element("h2", record.brand + " · " + record.model);
  title.id = "dialog-title";
  const fields = element("dl");
  const rows = [
    [record.status === "confirmed" ? "砂带尺寸" : "查询尺寸", displaySize(record.size) + " mm"],
    ["机型类型", types[record.type]],
    ["依据类型", record.level],
  ];
  rows.forEach(([label, value]) => fields.append(element("dt", label), element("dd", value)));
  const summary = element("p", record.summary);
  const heading = element("h3", record.status === "pending" ? "已有线索" : "适配依据");
  dialogContent.replaceChildren(badge(record.status), title, fields, summary, heading);

  if (record.sources.length) {
    const links = element("ul");
    record.sources.forEach(({ title: label, url }) => {
      const entry = element("li");
      const link = element("a", label);
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      entry.append(link);
      links.append(entry);
    });
    dialogContent.append(links);
  } else {
    dialogContent.append(element("p", "历史工作记录。公开规格来源待补。"));
  }

  if (record.note) {
    dialogContent.append(element("h3", record.status === "pending" ? "待核实项" : "适配条件"), element("p", record.note, "dialog-note"));
  }
  dialog.showModal();
}

function showRules() {
  const title = element("h2", "核实标准");
  title.id = "dialog-title";
  const entries = [
    ["已确认", "可查资料将具体型号与宽度、周长对应。卡片显示依据来自原厂、磨料目录还是经销商。"],
    ["标称尺寸", "资料使用英制或近似公制写法。详情列出原始规格，便于按实际机号与砂带宽度核对。"],
    ["待核实", "仍缺准确型号、可靠尺寸依据或对应配件。详情列出已有线索和下一项核对内容。"],
  ];
  const legend = element("dl");
  entries.forEach(([label, content]) => legend.append(element("dt", label), element("dd", content)));
  dialogContent.replaceChildren(title, legend, element("p", "本站确认的是资料支持的尺寸和配置。若涉及你手头的参考机、地区版本、砂带臂或砂带材质，请按详情里的条件核对。", "dialog-note"));
  dialog.showModal();
}

function makeRecord(record) {
  const node = $("#record-template").content.firstElementChild.cloneNode(true);
  const tile = $(".brand-tile", node);
  const initials = record.brand.match(/[A-Za-z]+/g)?.map(part => part[0]).join("") || "?";
  tile.textContent = initials.toUpperCase().slice(0, 3);
  tile.classList.toggle("is-pending", record.status === "pending");
  $(".record-brand", node).textContent = record.brand;
  $(".record-model", node).textContent = record.model;
  badge(record.status, $(".status-badge", node));
  $(".record-size", node).textContent = displaySize(record.size) + " mm";
  $(".record-type", node).textContent = types[record.type];
  $(".evidence-kind", node).textContent = record.level;
  $(".record-summary", node).textContent = record.summary;
  const button = $(".evidence-button", node);
  button.textContent = record.status === "pending" ? "查看待核实项" : "查看依据";
  button.setAttribute("aria-label", button.textContent + " · " + record.brand + " " + record.model);
  button.addEventListener("click", () => showEvidence(record));
  return node;
}

function renderEmpty() {
  const unknown = state.size && !sizeCount.has(state.size);
  const empty = element("div", "", "empty");
  empty.append(
    element("h3", unknown ? "这个尺寸还没有收录" : "暂无符合条件的机型"),
    element("p", unknown ? "可核对尺寸后重新输入，或返回全部尺寸。" : "可调整品牌、类型、核实状态或型号关键词。")
  );
  const reset = element("button", "查看全部机型");
  reset.type = "button";
  reset.addEventListener("click", clearFilters);
  empty.append(reset);
  return empty;
}

function render() {
  const custom = $("option[data-custom]", sizeSelect);
  if (custom) custom.remove();
  if (state.size && !sizeCount.has(state.size)) {
    const option = new Option(displaySize(state.size) + " mm", state.size);
    option.dataset.custom = "true";
    sizeSelect.append(option);
  }
  sizeSelect.value = state.size;
  brandFilter.value = state.brand;
  typeFilter.value = state.type;
  all("[data-size]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.size === state.size)));
  if (sizes.indexOf(state.size) >= 8) $(".more-sizes").open = true;

  const withinFilters = filterRecords(catalog, { ...state, status: "" });
  const matching = state.status ? withinFilters.filter(record => record.status === state.status) : withinFilters;
  all("[data-status]").forEach(button => {
    const status = button.dataset.status;
    button.setAttribute("aria-pressed", String(status === state.status));
    $("small", button).textContent = String(status
      ? withinFilters.filter(record => record.status === status).length : withinFilters.length);
  });
  all("[data-view]").forEach(button => {
    if (button.dataset.view === state.view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("#results-title").textContent = state.view === "pending" ? "核实清单" : "适配机型";
  $("#results-context").textContent = state.size ? "当前尺寸  " + displaySize(state.size) + " mm" : "当前范围  全部尺寸";
  $("#results-count").textContent = "显示 " + matching.length + " 条记录";
  resetButton.hidden = !state.size && !state.brand && !state.type && !state.status && !state.query;
  results.replaceChildren(...(matching.length ? matching.map(makeRecord) : [renderEmpty()]));
  syncUrl();
}

$("#total-sizes").textContent = sizes.length;
$("#total-confirmed").textContent = totals.confirmed;
$("#total-pending").textContent = totals.pending;
$("#nav-pending").textContent = totals.pending;
$("#size-buttons").append(sizeOption("", records.length), ...sizes.slice(0, 8).map(size => sizeOption(size, sizeCount.get(size))));
$("#extra-sizes").append(...sizes.slice(8).map(size => sizeOption(size, sizeCount.get(size))));
fillSelect(sizeSelect, "全部尺寸", sizes.map(size => [size, displaySize(size) + " mm"]));
fillSelect(brandFilter, "所有品牌", brands.map(brand => [brand, brand]));
fillSelect(typeFilter, "所有类型", Object.entries(types));
$("#status-buttons").append(statusOption("", "全部"), ...Object.entries(statuses).map(([key, title]) => statusOption(key, title)));

$("#size-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = sizeInput.value.trim();
  if (!value) {
    setSize("");
    return;
  }
  const size = parseSize(value);
  if (size) setSize(size);
  else showSizeError("请输入宽度 × 周长，例如 13×457。");
});
sizeInput.addEventListener("input", () => showSizeError());
sizeSelect.addEventListener("change", () => setSize(sizeSelect.value));
modelInput.addEventListener("input", () => {
  state.query = modelInput.value;
  render();
});
brandFilter.addEventListener("change", () => {
  state.brand = brandFilter.value;
  render();
});
typeFilter.addEventListener("change", () => {
  state.type = typeFilter.value;
  render();
});

all("[data-view]").forEach(button => button.addEventListener("click", () => {
  const view = button.dataset.view;
  if (view === state.view) return;
  clearFilters();
  state.view = view;
  state.status = view === "pending" ? "pending" : "";
  setSize(view === "pending" ? "" : sizes[0]);
}));

resetButton.addEventListener("click", clearFilters);
$("#rules-button").addEventListener("click", showRules);
$(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

modelInput.value = state.query;
sizeInput.value = state.size ? displaySize(state.size) : "";
render();
