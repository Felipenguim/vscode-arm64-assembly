/**
 * AArch64 SIMD vector arrangement / lane documentation.
 *
 * Used by the HoverProvider to explain vector operands that carry an element
 * arrangement (`v1.4s`, `v0.2d`, `v2.16b`) or a lane index (`v3.s[0]`).
 *
 * `REGISTER_DOCS` only knows the bare register names (`v1`, `q1`, `d1`, …), so
 * these operands used to miss every lookup in the hover provider. The helpers
 * here decode the suffix and render the lane layout instead.
 */

// ─── Arrangement table ────────────────────────────────────────────────────────

/** Decoded properties of a vector arrangement such as `.4s`. */
export interface Arrangement {
  /** Number of elements (lanes) in the vector. */
  lanes: number;
  /** Width of a single element, in bits. */
  elemBits: number;
  /** Bits of the 128-bit register actually used: `lanes * elemBits`. */
  totalBits: 64 | 128;
  /** Element-size letter used by lane-index syntax (`v1.s[0]` → `s`). */
  elemLetter: string;
  /** Human-readable element name and the types it usually holds. */
  elemName: string;
}

/** Element-size letter → width in bits. */
const ELEM_BITS: Record<string, number> = {
  b: 8,
  h: 16,
  s: 32,
  d: 64,
  q: 128,
};

/** Element-size letter → description of what a lane holds. */
const ELEM_NAMES: Record<string, string> = {
  b: 'byte: int8 / uint8',
  h: 'halfword: int16 / uint16 / FP16',
  s: 'word: int32 / uint32 / single-precision float',
  d: 'doubleword: int64 / uint64 / double-precision float',
  q: 'quadword: a single 128-bit integer',
};

function buildArrangements(): Map<string, Arrangement> {
  const m = new Map<string, Arrangement>();

  // Keys are written without the leading dot, lowercase — the hover provider
  // normalises with toLowerCase() before looking up.
  const forms = ['16b', '8b', '8h', '4h', '4s', '2s', '2d', '1d', '1q'];

  for (const form of forms) {
    const lanes      = parseInt(form, 10);
    const elemLetter = form.slice(String(lanes).length);
    const elemBits   = ELEM_BITS[elemLetter];
    const totalBits  = lanes * elemBits;

    m.set(form, {
      lanes,
      elemBits,
      totalBits: totalBits === 64 ? 64 : 128,
      elemLetter,
      elemName: ELEM_NAMES[elemLetter],
    });
  }

  return m;
}

/** All arrangements accepted by GAS, keyed without the leading dot (`"4s"`). */
export const ARRANGEMENTS: ReadonlyMap<string, Arrangement> = buildArrangements();

/**
 * The eight arrangements that come in a 128-bit / 64-bit pair, listed as
 * `[full128, lower64]`. `.1q` has no 64-bit counterpart and is noted separately.
 */
const ARRANGEMENT_PAIRS: readonly (readonly [string, string])[] = [
  ['16b', '8b'],
  ['8h',  '4h'],
  ['4s',  '2s'],
  ['2d',  '1d'],
];

// ─── Lane layout rendering ────────────────────────────────────────────────────

/** Lanes drawn per row of the ASCII strip; keeps `.16b` from overflowing the hover. */
const LANES_PER_ROW = 4;

/**
 * Render the element layout of an arrangement as an ASCII strip, most
 * significant lane first. Each cell shows the lane label and its bit range.
 *
 * `highlight` marks one lane with `>` (used by the lane-index hover).
 */
function renderLaneStrip(
  lanes: number,
  elemBits: number,
  elemLetter: string,
  highlight?: number
): string {
  const labels: string[] = [];
  const ranges: string[] = [];

  for (let i = lanes - 1; i >= 0; i--) {
    const mark = i === highlight ? '>' : '';
    labels.push(`${mark}${elemLetter}[${i}]`);
    ranges.push(`${(i + 1) * elemBits - 1}:${i * elemBits}`);
  }

  const width = Math.max(...labels.map(s => s.length), ...ranges.map(s => s.length)) + 2;
  const cell  = '─'.repeat(width);

  const perRow = Math.min(lanes, LANES_PER_ROW);
  const border = (l: string, mid: string, r: string) =>
    l + Array(perRow).fill(cell).join(mid) + r;

  const row = (values: string[]) =>
    '│' + values.map(v => v.padStart(width - 1).padEnd(width)).join('│') + '│';

  const out: string[] = [border('┌', '┬', '┐')];

  for (let start = 0; start < lanes; start += perRow) {
    if (start > 0) { out.push(border('├', '┼', '┤')); }
    out.push(row(labels.slice(start, start + perRow)));
    out.push(row(ranges.slice(start, start + perRow)));
  }

  out.push(border('└', '┴', '┘'));
  return out.join('\n');
}

/**
 * Markdown table listing every arrangement of the same `v` register, with the
 * one currently under the cursor in bold.
 */
function renderOtherArrangements(regNum: string, current: string): string {
  const cellFor = (form: string): string => {
    const a    = ARRANGEMENTS.get(form)!;
    const text = `\`.${form}\` — ${a.lanes} × ${a.elemBits}-bit`;
    return form === current ? `**${text}**` : text;
  };

  let md = `**All arrangements of \`v${regNum}\`**\n\n`;
  md += `| Full 128 bits | Lower 64 bits |\n| --- | --- |\n`;
  for (const [full, half] of ARRANGEMENT_PAIRS) {
    md += `| ${cellFor(full)} | ${cellFor(half)} |\n`;
  }
  md += `| ${cellFor('1q')} | — |\n`;

  return md;
}

// ─── Public hover builders ────────────────────────────────────────────────────

/**
 * Describe a vector register with an arrangement, e.g. `describeArrangement("1", "4s")`.
 *
 * Returns `undefined` when the arrangement is not one of the nine GAS forms.
 */
export function describeArrangement(regNum: string, arr: string): string | undefined {
  const a = ARRANGEMENTS.get(arr);
  if (!a) { return undefined; }

  const reg  = `v${regNum}`;
  const name = `${reg}.${arr}`.toUpperCase();

  const plural = a.lanes === 1 ? '' : 's';

  let md = `**\`${name}\`** — Vector register, ${a.lanes} × ${a.elemBits}-bit lane${plural}\n\n`;
  md += `\`${reg}\` (128-bit) viewed as **${a.lanes} lane${plural}** of ` +
        `**${a.elemBits}-bit** element${plural} — ${a.elemName}.\n\n`;

  if (a.totalBits === 64) {
    md += `Uses only the **lower 64 bits** of \`${reg}\`. ` +
          `Writing this arrangement zeroes bits \`[127:64]\`.\n\n`;
  } else {
    md += `Uses the **full 128 bits** of \`${reg}\`.\n\n`;
  }

  md += `\`\`\`text\n${renderLaneStrip(a.lanes, a.elemBits, a.elemLetter)}\n\`\`\`\n`;
  md += a.lanes === 1
    ? `Single-lane arrangement — the whole value is \`${reg}.${a.elemLetter}[0]\`.\n\n`
    : `Address a single lane with \`${reg}.${a.elemLetter}[i]\`, \`i\` ∈ 0–${a.lanes - 1}.\n\n`;
  md += `---\n\n`;
  md += renderOtherArrangements(regNum, arr);

  return md;
}

/**
 * Describe a single vector element, e.g. `describeLane("3", "s", 0)` for `v3.s[0]`.
 *
 * Returns `undefined` when the element-size letter is unknown. An out-of-range
 * index still produces a hover — with an explicit warning, since GAS would
 * reject the operand.
 */
export function describeLane(
  regNum: string,
  elem: string,
  index: number
): string | undefined {
  const elemBits = ELEM_BITS[elem];
  if (elemBits === undefined) { return undefined; }

  const reg      = `v${regNum}`;
  const lanes    = 128 / elemBits;
  const maxIndex = lanes - 1;
  const name     = `${reg}.${elem}[${index}]`.toUpperCase();

  let md = `**\`${name}\`** — Vector element (single lane)\n\n`;

  if (index > maxIndex) {
    md += `⚠ **Index out of range.** \`${reg}.${elem}[]\` accepts **0–${maxIndex}** ` +
          `(${lanes} lanes of ${elemBits} bits in a 128-bit register).\n\n`;
    return md;
  }

  const hi = (index + 1) * elemBits - 1;
  const lo = index * elemBits;

  md += `One **${elemBits}-bit** element of \`${reg}\` — ${ELEM_NAMES[elem]}.\n\n`;
  md += `Occupies bits \`[${hi}:${lo}]\`. Valid indices: **0–${maxIndex}**.\n\n`;
  md += `\`\`\`text\n${renderLaneStrip(lanes, elemBits, elem, index)}\n\`\`\`\n`;
  md += `Element syntax is used by \`INS\`, \`UMOV\`/\`SMOV\`, \`DUP\`, the single-lane ` +
        `\`LD1\`/\`ST1\` forms, and by-element arithmetic ` +
        `(e.g. \`FMUL v0.4s, v1.4s, v2.s[${index}]\`).`;

  return md;
}
