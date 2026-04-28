/**
 * MongoDB Compatibility Types for CVision
 *
 * These type aliases let CVision code compile without the `mongodb` package.
 * At runtime, all calls go through the Prisma-backed layer (lib/cvision/prisma-db.ts).
 */

import type { PrismaDb, PrismaCollection } from '@/lib/cvision/prisma-db';

export type Db = PrismaDb;
export type Collection<T = any> = PrismaCollection;
export type Filter<T = any> = Record<string, any>;
export type FindOptions = Record<string, any>;
export type Sort = Record<string, number>;
export type UpdateFilter<T = any> = Record<string, any>;
export type WithId<T> = T & { _id?: any };
export type OptionalUnlessRequiredId<T> = T;
export type Document = Record<string, any>;

export class ObjectId {
  private _id: string;
  constructor(id?: string) {
    this._id = id || '';
  }
  toString(): string {
    return this._id;
  }
  toHexString(): string {
    return this._id;
  }
  static isValid(id: any): boolean {
    if (!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(String(id));
  }
  static createFromHexString(hex: string): ObjectId {
    return new ObjectId(hex);
  }
}
