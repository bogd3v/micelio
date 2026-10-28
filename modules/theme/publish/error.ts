/** A version cannot be published, or the index cannot take a change; the message says why, one line. */
export class PublishError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublishError'
  }
}
