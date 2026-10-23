import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import {
	normalizePrintLevel,
	printMessage,
	RequestQueue,
	type QueueRequestInput,
	type QueueProcessResult,
	type PrintLevel,
	type QueuedRequest,
	type SharedDataValue,
} from './services/advancedExpressions.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()
	readonly requestQueue = new RequestQueue()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = { ...config, sharedData: config.sharedData ?? {} }

		this.updateStatus(InstanceStatus.Ok)

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export Presets
		this.updateVariableDefinitions() // export variable definitions
		this.refreshAdvancedVariables()
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = { ...config, sharedData: config.sharedData ?? {} }
		this.refreshAdvancedVariables()
	}

	setSharedData(key: string, value: SharedDataValue): void {
		const normalizedKey = key.trim()
		if (!normalizedKey) throw new Error('Shared data key must not be empty.')

		const nextConfig: ModuleConfig = {
			...this.config,
			sharedData: {
				...(this.config.sharedData ?? {}),
				[normalizedKey]: value,
			},
		}
		this.config = nextConfig
		this.saveConfig(nextConfig)
	}

	setSharedDataVariables(key: string): void {
		const normalizedKey = key.trim()
		const sharedData = this.config.sharedData ?? {}
		const exists = Object.prototype.hasOwnProperty.call(sharedData, normalizedKey)
		const value = exists ? sharedData[normalizedKey] : undefined
		this.setVariableValues({
			sharedDataKey: normalizedKey,
			sharedDataValue: exists ? JSON.stringify(value, null, 2) : '',
			sharedDataExists: String(exists),
		})
	}

	addRequest(request: QueueRequestInput): void {
		this.requestQueue.add(request)
	}

	findRequest(id: string): QueuedRequest | undefined {
		return this.requestQueue.find(id)
	}

	async processRequests(): Promise<QueueProcessResult> {
		return this.requestQueue.processReady(async (request) => {
			if (request.action.toUpperCase() !== 'PRINT') {
				throw new Error(`Unsupported request action "${request.action}". Only PRINT is implemented.`)
			}
			if (!Object.prototype.hasOwnProperty.call(request.payload, 'message')) {
				throw new Error('PRINT request payload must include a message property.')
			}

			const level: PrintLevel = normalizePrintLevel(request.payload.level)
			const prefix = typeof request.payload.prefix === 'string' ? request.payload.prefix : undefined
			printMessage(this.log.bind(this), request.payload.message, level, prefix)
		})
	}

	refreshAdvancedVariables(): void {
		this.setVariableValues({
			requestQueueReady: String(this.requestQueue.getReadyCount()),
			requestQueuePending: String(this.requestQueue.getPendingCount()),
		})
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}
