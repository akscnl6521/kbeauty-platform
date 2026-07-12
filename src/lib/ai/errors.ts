export class AnalyzeSkinError extends Error {
  status: number;
  code: "BAD_REQUEST" | "CONFIG" | "PROVIDER" | "PARSE";

  constructor(
    message: string,
    status: number,
    code: "BAD_REQUEST" | "CONFIG" | "PROVIDER" | "PARSE"
  ) {
    super(message);
    this.name = "AnalyzeSkinError";
    this.status = status;
    this.code = code;
  }
}
