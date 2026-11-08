export class StagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagingError";
  }
}
