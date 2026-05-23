import { ValueTransformer } from 'typeorm';

export const bigintToNumber: ValueTransformer = {
  to: (value: number | null | undefined): number | null =>
    value === null || value === undefined ? null : value,
  from: (value: string | null): number | null =>
    value === null ? null : parseInt(value, 10),
};

export const numericToNumber: ValueTransformer = {
  to: (value: number | null | undefined): number | null =>
    value === null || value === undefined ? null : value,
  from: (value: string | null): number | null =>
    value === null ? null : parseFloat(value),
};
