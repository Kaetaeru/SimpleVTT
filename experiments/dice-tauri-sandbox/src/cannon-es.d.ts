import "cannon-es";

declare module "cannon-es" {
  interface Solver {
    iterations: number;
    tolerance: number;
  }
}
