import type { LogLevel } from '@companion-module/base'

export type PrintLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export type SharedDataValue = string | number | boolean | SharedDataValue[] | { [key: string]: SharedDataValue }

export type QueueRequestInput = {
	id: string | number
	shouldSend: boolean
	action: string
	payload: Record<string, unknown>
}

export type QueuedRequest = QueueRequestInput & {
	id: string
	status: 'pending' | 'processing' | 'completed' | 'failed'
	error?: string
}

export type QueueProcessResult = {
	processed: number
	failed: number
	skipped: boolean
	failures: Array<{ id: string; message: string }>
}

const printLevels: Record<PrintLevel, LogLevel> = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error',
}

export function normalizePrintLevel(value: unknown): PrintLevel {
	if (typeof value !== 'string') return 'INFO'
	const normalized = value.toUpperCase()
	switch (normalized) {
		case 'DEBUG':
		case 'INFO':
		case 'WARN':
		case 'ERROR':
			return normalized
		default:
			return 'INFO'
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function parsePrintValue(value: string): unknown {
	try {
		return JSON.parse(value) as unknown
	} catch {
		return value
	}
}

export function formatLogValue(value: unknown): string {
	if (typeof value === 'string') return value

	try {
		const seen = new WeakSet<object>()
		const formatted = JSON.stringify(
			value,
			(_key, item: unknown) => {
				if (typeof item === 'bigint') return `${item.toString()}n`
				if (item instanceof Error) {
					return {
						name: item.name,
						message: item.message,
						stack: item.stack,
					}
				}
				if (typeof item === 'object' && item !== null) {
					if (seen.has(item)) return '[Circular]'
					seen.add(item)
				}
				return item
			},
			2,
		)

		return formatted ?? String(value)
	} catch (error) {
		let fallback = '[unserializable value]'
		try {
			fallback = String(value)
		} catch {
			// Proxies and custom coercion hooks can also throw during fallback conversion.
		}
		return `${fallback} [formatting error: ${errorMessage(error)}]`
	}
}

export function printMessage(
	log: (level: LogLevel, message: string) => void,
	value: unknown,
	level: PrintLevel = 'INFO',
	prefix?: string,
): void {
	const formatted = formatLogValue(value)
	const message = prefix?.trim() ? `[${prefix.trim()}] ${formatted}` : formatted
	log(printLevels[level], message)
}

export function isSharedDataValue(value: unknown): value is SharedDataValue {
	if (typeof value === 'string' || typeof value === 'boolean') return true
	if (typeof value === 'number') return Number.isFinite(value)
	if (Array.isArray(value)) return value.every(isSharedDataValue)
	if (typeof value !== 'object' || value === null) return false

	const prototype = Object.getPrototypeOf(value)
	if (prototype !== Object.prototype && prototype !== null) return false
	return Object.values(value).every(isSharedDataValue)
}

export function parseSharedDataValue(value: string): SharedDataValue {
	let parsed: unknown
	try {
		parsed = JSON.parse(value) as unknown
	} catch (error) {
		throw new Error(`Shared data must be valid JSON: ${errorMessage(error)}`, { cause: error })
	}

	if (!isSharedDataValue(parsed)) {
		throw new Error('Shared data must be a JSON string, number, Boolean, array, or object.')
	}

	return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseQueueRequest(value: string): QueueRequestInput {
	let parsed: unknown
	try {
		parsed = JSON.parse(value) as unknown
	} catch (error) {
		throw new Error(`Request must be valid JSON: ${errorMessage(error)}`, { cause: error })
	}

	if (!isRecord(parsed)) throw new Error('Request must be a JSON object.')

	const { id, shouldSend, action, payload } = parsed
	if (!(typeof id === 'string' && id.trim().length > 0) && !(typeof id === 'number' && Number.isFinite(id))) {
		throw new Error('Request id must be a non-empty string or finite number.')
	}
	if (typeof shouldSend !== 'boolean') throw new Error('Request shouldSend must be a Boolean.')
	if (typeof action !== 'string' || action.trim().length === 0) {
		throw new Error('Request action must be a non-empty string.')
	}
	if (!isRecord(payload)) throw new Error('Request payload must be a JSON object.')

	return {
		id,
		shouldSend,
		action: action.trim(),
		payload,
	}
}

function cloneRequest(request: QueuedRequest): QueuedRequest {
	return JSON.parse(JSON.stringify(request)) as QueuedRequest
}

export class RequestQueue {
	readonly #requests = new Map<string, QueuedRequest>()
	#processing = false

	add(request: QueueRequestInput): QueuedRequest {
		const id = String(request.id).trim()
		if (id.length === 0) throw new Error('Request id must not be empty.')
		if (this.#requests.has(id)) throw new Error(`A request with id "${id}" already exists.`)

		const entry: QueuedRequest = {
			...request,
			id,
			status: 'pending',
		}
		this.#requests.set(id, entry)
		return cloneRequest(entry)
	}

	find(id: string): QueuedRequest | undefined {
		const request = this.#requests.get(id)
		return request ? cloneRequest(request) : undefined
	}

	getReadyCount(): number {
		return [...this.#requests.values()].filter((request) => request.shouldSend && request.status === 'pending').length
	}

	getPendingCount(): number {
		return [...this.#requests.values()].filter((request) => request.status === 'pending').length
	}

	async processReady(handler: (request: QueuedRequest) => Promise<void>): Promise<QueueProcessResult> {
		if (this.#processing) return { processed: 0, failed: 0, skipped: true, failures: [] }

		this.#processing = true
		let processed = 0
		let failed = 0
		const failures: QueueProcessResult['failures'] = []
		try {
			const ready = [...this.#requests.values()].filter((request) => request.shouldSend && request.status === 'pending')
			for (const request of ready) {
				request.status = 'processing'
				try {
					await handler(cloneRequest(request))
					request.status = 'completed'
					processed++
				} catch (error) {
					request.status = 'failed'
					request.error = errorMessage(error)
					failures.push({ id: request.id, message: request.error })
					failed++
				}
			}
		} finally {
			this.#processing = false
		}

		return { processed, failed, skipped: false, failures }
	}
}
