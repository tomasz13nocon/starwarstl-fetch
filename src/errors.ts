export class FetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigError extends FetchError {}

export class CliError extends FetchError {}

export class FixtureError extends FetchError {}

export class PipelineError extends FetchError {}

export class WookieepediaApiError extends FetchError {}

export class WookieepediaPageError extends FetchError {}

export class ImageProcessingError extends FetchError {}
