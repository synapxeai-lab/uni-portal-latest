import { z } from "zod";

/** The institute's fee collection account, shown to students on their challan. */
export const PAYMENT_ACCOUNT_NUMBER = "PK00-UNIV-0001-0000-0000-1234";

/** Course fees (Rs.) and discount rates (percent). */
export const feeField = z
  .number()
  .int("Fee must be a whole number")
  .min(0, "Fee cannot be negative")
  .max(100_000_000, "Fee is too large");

export const discountRateField = z
  .number()
  .min(0, "Discount cannot be negative")
  .max(100, "Discount cannot be more than 100%");

/** `amount` with `rate` percent taken off, rounded to whole rupees. */
export function applyDiscount(amount: number, rate: number | null | undefined): number {
  return Math.round(amount * (1 - (rate || 0) / 100));
}

/** A course's whole fee: its own fee plus its extra fees (Uniform Fee...). */
export function courseTotalFee(course: { fee: number; extraFees?: { amount: number }[] }): number {
  return course.fee + (course.extraFees ?? []).reduce((sum, fee) => sum + fee.amount, 0);
}
