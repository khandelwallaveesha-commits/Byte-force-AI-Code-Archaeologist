/* ======================================================================
   zip.js — minimal ZIP reader, no dependencies.

   Reads the central directory, then inflates each entry with the browser's
   own DecompressionStream('deflate-raw'). Enough to unpack a source archive;
   it is not a general-purpose ZIP implementation (no encryption, no zip64).
   ====================================================================== */

const EOCD_SIG = 0x06054b50;
const CEN_SIG  = 0x02014b50;

const decoder = new TextDecoder('utf-8', { fatal: false });

export const canUnzip = () => typeof DecompressionStream === 'function';

/** Scan backwards for the End Of Central Directory record. */
function findEOCD(view) {
  const max = Math.min(view.byteLength, 66_000); // comment field caps at 64K
  for (let i = 22; i <= max; i++) {
    const off = view.byteLength - i;
    if (off < 0) break;
    if (view.getUint32(off, true) === EOCD_SIG) return off;
  }
  return -1;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{path: string, content: string}[]>}
 */
export async function readZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const eocd = findEOCD(view);
  if (eocd < 0) throw new Error('Not a ZIP file (no end-of-archive record).');

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  const out = [];

  for (let i = 0; i < count; i++) {
    if (ptr + 46 > view.byteLength || view.getUint32(ptr, true) !== CEN_SIG) break;

    const method    = view.getUint16(ptr + 10, true);
    const compSize  = view.getUint32(ptr + 20, true);
    const nameLen   = view.getUint16(ptr + 28, true);
    const extraLen  = view.getUint16(ptr + 30, true);
    const commentLen= view.getUint16(ptr + 32, true);
    const localOff  = view.getUint32(ptr + 42, true);
    const name      = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    ptr += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue;                       // directory entry

    /* the local header repeats the name/extra lengths, and they can differ */
    const lNameLen  = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    try {
      let data;
      if (method === 0) data = raw;
      else if (method === 8) data = await inflateRaw(raw);
      else continue;                                        // unsupported method
      out.push({ path: name, content: decoder.decode(data) });
    } catch (e) {
      /* one bad entry should not sink the whole archive */
    }
  }

  if (!out.length) throw new Error('No readable files inside the ZIP.');
  return out;
}
