import type { Report, ReportRecord } from '@plugjs/plug/logging'

export class MockReport implements Report {
  private _records: ReportRecord[] = []

  // Mock properties
  readonly notices: number = -1
  readonly warnings: number = -1
  readonly errors: number = -1
  readonly noticeRecords: number = -1
  readonly warningRecords: number = -1
  readonly errorRecords: number = -1
  readonly noticeAnnotations: number = -1
  readonly warningAnnotations: number = -1
  readonly errorAnnotations: number = -1
  readonly records: number = -1
  readonly annotations: number = -1
  get empty(): boolean {
    return this._records.length === 0
  }

  add(...records: ReportRecord[]): this {
    this._records.push(...records)
    return this
  }

  annotate(): this {
    throw new Error('Method not implemented.')
  }

  loadSources(): Promise<void> {
    throw new Error('Method not implemented.')
  }
  done(): void {
    throw new Error('Method not implemented.')
  }

  get data(): ReportRecord[] {
    return this._records
  }
}
