export class SubjectConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubjectConfigurationError";
  }
}
