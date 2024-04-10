// @ts-nocheck
import { Fr } from "@aztec/bb.js";
import { randomBytes } from "crypto";

const ZERO_BUFFER = Buffer.alloc(32);

export class BufferReader {
  index;
  constructor(buffer, offset = 0) {
    this.index = offset;
  }

  static asReader(bufferOrReader) {
    return bufferOrReader instanceof BufferReader
      ? bufferOrReader
      : new BufferReader(bufferOrReader);
  }

  readNumber() {
    const dataView = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.index,
      4
    );
    this.index += 4;
    return dataView.getUint32(0, false);
  }

  readBoolean() {
    this.index += 1;
    return Boolean(this.buffer.at(this.index - 1));
  }

  readBytes(n) {
    this.index += n;
    return this.buffer.slice(this.index - n, this.index);
  }

  readNumberVector() {
    return this.readVector({
      fromBuffer: (reader) => reader.readNumber(),
    });
  }

  readVector(itemDeserializer) {
    const size = this.readNumber();
    const result = new Array<T>(size);
    for (let i = 0; i < size; i++) {
      result[i] = itemDeserializer.fromBuffer(this);
    }
    return result;
  }

  readArray(size, itemDeserializer) {
    const result = new Array<T>(size);
    for (let i = 0; i < size; i++) {
      result[i] = itemDeserializer.fromBuffer(this);
    }
    return result;
  }

  readObject(deserializer) {
    return deserializer.fromBuffer(this);
  }

  peekBytes(n) {
    return this.buffer.subarray(this.index, n ? this.index + n : undefined);
  }

  readString() {
    return new TextDecoder().decode(this.readBuffer());
  }

  readBuffer() {
    const size = this.readNumber();
    return this.readBytes(size);
  }

  readMap(deserializer) {
    const numEntries = this.readNumber();
    const map = {};
    for (let i = 0; i < numEntries; i++) {
      const key = this.readString();
      const value = this.readObject<T>(deserializer);
      map[key] = value;
    }
    return map;
  }
}

/**
 * Constructs a field from a Buffer of BufferReader.
 * It maybe not read the full 32 bytes if the Buffer is shorter, but it will padded in BaseField constructor.
 */
export function fromBuffer(buffer, f) {
  const reader = BufferReader.asReader(buffer);
  return new f(reader.readBytes(BaseField.SIZE_IN_BYTES));
}

/**
 * Constructs a field from a Buffer, but reduces it first.
 * This requires a conversion to a bigint first so the initial underlying representation will be a bigint.
 */
function fromBufferReduce(buffer, f) {
  return new f(toBigIntBE(buffer) % f.MODULUS);
}

/**
 * To ensure a field is uniformly random, it's important to reduce a 512 bit value.
 * If you reduced a 256 bit number, there would a be a high skew in the lower range of the field.
 */
function random(f) {
  return fromBufferReduce(randomBytes(64), f);
}

/**
 * Constructs a field from a 0x prefixed hex string.
 */
function fromString(buf, f) {
  const buffer = Buffer.from(buf.replace(/^0x/i, ""), "hex");
  return new f(buffer);
}

/**
 * Convert a BigInt to a big-endian buffer.
 * @param num - The BigInt to convert.
 * @param width - The number of bytes that the resulting buffer should be.
 * @returns A big-endian buffer representation of num.
 */
export function toBufferBE(num, width) {
  if (num < BigInt(0)) {
    throw new Error(
      `Cannot convert negative bigint ${num.toString()} to buffer with toBufferBE.`
    );
  }
  const hex = num.toString(16);
  const buffer = Buffer.from(
    hex.padStart(width * 2, "0").slice(0, width * 2),
    "hex"
  );
  if (buffer.length > width) {
    throw new Error(`Number ${num.toString(16)} does not fit in ${width}`);
  }
  return buffer;
}

/**
 * Convert a big-endian buffer into a BigInt.
 * @param buf - The big-endian buffer to convert.
 * @returns A BigInt with the big-endian representation of buf.
 */
export function toBigIntBE(buf) {
  const hex = buf.toString("hex");
  if (hex.length === 0) {
    return BigInt(0);
  }
  return BigInt(`0x${hex}`);
}

/**
 * Base field class.
 * Conversions from Buffer to BigInt and vice-versa are not cheap.
 * We allow construction with either form and lazily convert to other as needed.
 * We only check we are within the field modulus when initializing with bigint.
 * If NODE_ENV === 'test', we will always initialize both types to check the modulus.
 * This is also necessary in test environment as a lot of tests just use deep equality to check equality.
 * WARNING: This could lead to a bugs in production that don't reveal in tests, but it's low risk.
 */
class BaseField {
  static SIZE_IN_BYTES = 32;
  asBuffer;
  asBigInt;

  /**
   * Return bigint representation.
   * @deprecated Just to get things compiling. Use toBigInt().
   * */
  get value() {
    return this.toBigInt();
  }

  constructor(value) {
    if (value instanceof Buffer) {
      if (value.length > BaseField.SIZE_IN_BYTES) {
        throw new Error(
          `Value length ${value.length} exceeds ${BaseField.SIZE_IN_BYTES}`
        );
      }
      this.asBuffer =
        value.length === BaseField.SIZE_IN_BYTES
          ? value
          : Buffer.concat([
              Buffer.alloc(BaseField.SIZE_IN_BYTES - value.length),
              value,
            ]);
    } else if (
      typeof value === "bigint" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      this.asBigInt = BigInt(value);
      if (this.asBigInt >= this.modulus()) {
        throw new Error(
          `Value 0x${this.asBigInt.toString(
            16
          )} is greater or equal to field modulus.`
        );
      }
    } else if (value instanceof BaseField) {
      this.asBuffer = value.asBuffer;
      this.asBigInt = value.asBigInt;
    } else {
      throw new Error(
        `Type '${typeof value}' with value '${value}' passed to BaseField ctor.`
      );
    }

    // Loads of our tests are just doing deep equality rather than calling e.g. toBigInt() first.
    // This ensures the deep equality passes regardless of the internal representation.
    // It also ensures the value range is checked even when initializing as a buffer.
    if (process.env.NODE_ENV === "test") {
      this.toBuffer();
      this.toBigInt();
    }
  }

  /**
   * We return a copy of the Buffer to ensure this remains immutable.
   */
  toBuffer() {
    if (!this.asBuffer) {
      this.asBuffer = toBufferBE(this.asBigInt, 32);
    }
    return Buffer.from(this.asBuffer);
  }

  toString() {
    return `0x${this.toBuffer().toString("hex")}`;
  }

  toBigInt() {
    if (this.asBigInt === undefined) {
      this.asBigInt = toBigIntBE(this.asBuffer);
      if (this.asBigInt >= this.modulus()) {
        throw new Error(
          `Value 0x${this.asBigInt.toString(
            16
          )} is greater or equal to field modulus.`
        );
      }
    }
    return this.asBigInt;
  }

  toBool() {
    retur(this.toBigInt());
  }

  toNumber() {
    const value = this.toBigInt();
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Value ${value.toString(16)} greater than than max safe integer`
      );
    }
    return Number(value);
  }

  toShortString() {
    const str = this.toString();
    return `${str.slice(0, 10)}...${str.slice(-4)}`;
  }

  equals(rhs) {
    return this.toBuffer().equals(rhs.toBuffer());
  }

  lt(rhs) {
    return this.toBigInt() < rhs.toBigInt();
  }

  cmp(rhs) {
    const lhsBigInt = this.toBigInt();
    const rhsBigInt = rhs.toBigInt();
    return lhsBigInt === rhsBigInt ? 0 : lhsBigInt < rhsBigInt ? -1 : 1;
  }

  isZero() {
    return this.toBuffer().equals(ZERO_BUFFER);
  }

  toFriendlyJSON() {
    return this.toString();
  }

  toField() {
    return this;
  }
}

export class Fq extends BaseField {
  static ZERO = new Fq(0n);
  static MODULUS =
    0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
  static HIGH_SHIFT = BigInt((BaseField.SIZE_IN_BYTES / 2) * 8);
  static LOW_MASK = (1n << Fq.HIGH_SHIFT) - 1n;

  get low() {
    return new Fr(this.toBigInt() & Fq.LOW_MASK);
  }

  get high() {
    return new Fr(this.toBigInt() >> Fq.HIGH_SHIFT);
  }

  constructor(value) {
    super(value);
  }

  modulus() {
    return Fq.MODULUS;
  }

  static random() {
    return random(Fq);
  }

  static zero() {
    return Fq.ZERO;
  }

  static fromBuffer(buffer) {
    return fromBuffer(buffer, Fq);
  }

  static fromBufferReduce(buffer) {
    return fromBufferReduce(buffer, Fq);
  }

  static fromString(buf) {
    return fromString(buf, Fq);
  }
}
