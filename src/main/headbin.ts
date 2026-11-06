import { createHash } from 'node:crypto'

// Fake package header template from VitaShell (GPL-3.0), patched the same way its makeHeadBin() does.
const TEMPLATE_BASE64 =
  'f1BLRwAAAAEAAAKAAAAACwAAAZAAAAADAAAAAAABkAAAAAAAAAAKkAAAAAAAAAMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAApomUOBny3QWHlLC2f8kwdtwvIvIlQMbflMu3ePiiVJWM5v10gQz3nUeyhmA8LgC7ogdZUeeVpO2DUDW8ZWP+cIurDElznaPJH3RIInCT/OlAynSXuvHeHKpnt0F41xVof2V4dAAAAAEAAABAAAABgAAAAQAAAAQQAAAAAAAADeAAAAAAwAAAAgAABCAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////////8KosshizcGLT4F+hFycoiFyXsDmaBwnPjPnUEB1hef01d5Z/m2+FY9yvyhmOLHz9YuG9Ybvm/Bkr7gs8LlZVpF2Yi0l14WMT2iPhau1LfVNuOsgI8Y/q0ahSDO7tpdt5VGNMxJUgn266UK5Xy1f69vTAaM5NhaA6+STpVbvODCrP8SlTGSrQboFyyx3Dakw5viPivsZVPrWIRJCQv0xrQCcPNkWHUUAPhoiEZ+XLy+i1+s4OSm9Xfd2eWvBfBdriJ/tNEcf8w+mFW5adLSEFVFSzyVcLfD2/4jr80notOsjBEJv/ayAWIJwdr9p0epSPRGJgbydk3+bz8QsBwa3nOLFHM8ObbGG6FlmbgzrLgWtOal7AILW3Aj6yQa94zaVZbdSxyFg0kBsjm8MTvo8VpJzM8PhV9UeegxjVcbscKTh+LmVs+SUfxJlM21BBsER/e00mcxVPCtOtQljO3pmxL8Rxz8boEpizmru/A1AIeIhwAAAAEAAAAEAAAAAgAAAAIAAAAEAAAAFQAAAAMAAAAEAAAADgAAAAQAAAAIAAAAAAABkAAAAAAFAAAABBlnAQAAAAAIAAAACAAAAAAAAAAAAAAACQAAAAgAAAAAACQAAAAAAA0AAAAoAAAAAAAAALAakgcEYQydFFWOF3S2RNJck/PBWA+RIi/9tEKqZPyK0AAAAA8AAABIAAAFkAAAAyAAAAAAAAAAAAAAAAABAQEBAAAAAAAAAAAAAAAAAAAAAL6aByYakdY1k81Z9BMjNAVbxPXDMfP58X7bf1MPGgp5AAAAEAAAADgAAAowAAAAYMIAAAAAAAABAAAAAAAAAADDKqD3OkGEfLhmQ3vKzWheRKvZhclrrTOpvIjGdcUjngAAABEAAAAoAXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHr+9Xkwr3bgRvx13whOuEU9T8v0PZv6X2GZat6cLhqcGRUQHXHmwFqEPSDorh4ccZTuvHNNLEa/PPNbMDrDGCD//////////////////////////////////////////w=='

const TEMPLATE = Buffer.from(TEMPLATE_BASE64, 'base64')
const CONTENT_ID_OFFSET = 0x30
const CONTENT_ID_SIZE = 48

function fpkgHmac(data: Buffer): Buffer {
  const sha1 = createHash('sha1').update(data).digest()
  const buf = Buffer.alloc(64)
  sha1.copy(buf, 0, 4, 12)
  sha1.copy(buf, 8, 4, 12)
  sha1.copy(buf, 16, 12, 16)
  buf[20] = sha1[16]
  buf[21] = sha1[1]
  buf[22] = sha1[2]
  buf[23] = sha1[3]
  buf.copy(buf, 24, 16, 24)
  return createHash('sha1').update(buf).digest().subarray(0, 16)
}

export function buildHeadBin(titleId: string, contentId = ''): Buffer {
  if (!/^[A-Z0-9]{9}$/.test(titleId)) throw new Error(`Invalid title ID: ${titleId}`)
  const head = Buffer.from(TEMPLATE)

  const id = contentId || `EP9000-${titleId}_00-0000000000000000`
  head.fill(0, CONTENT_ID_OFFSET, CONTENT_ID_OFFSET + CONTENT_ID_SIZE)
  head.write(id.slice(0, CONTENT_ID_SIZE), CONTENT_ID_OFFSET, 'latin1')

  let len = head.readUInt32BE(0xd0)
  fpkgHmac(head.subarray(0, len)).copy(head, len)

  const off = head.readUInt32BE(0x8)
  const infoLen = head.readUInt32BE(0x10)
  const out = head.readUInt32BE(0xd4)
  fpkgHmac(head.subarray(off, off + infoLen - 64)).copy(head, out)

  len = head.readUInt32BE(0xe8)
  fpkgHmac(head.subarray(0, len)).copy(head, len)

  return head
}
