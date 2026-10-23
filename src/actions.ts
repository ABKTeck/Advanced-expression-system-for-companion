import type ModuleInstance from './main.js'
import {
	parsePrintValue,
	parseQueueRequest,
	parseSharedDataValue,
	normalizePrintLevel,
	printMessage,
	type PrintLevel,
} from './services/advancedExpressions.js'

export type ActionsSchema = {
	sample_action: {
		options: {
			num: number
		}
	}
	print_message: {
		options: {
			message: string
			level: PrintLevel
			prefix: string
		}
	}
	set_shared_data: {
		options: {
			key: string
			value: string
		}
	}
	get_shared_data: {
		options: {
			key: string
		}
	}
	has_shared_data: {
		options: {
			key: string
		}
	}
	add_request: {
		options: {
			request: string
		}
	}
	find_request: {
		options: {
			id: string
		}
	}
	check_request_queue: {
		options: Record<string, never>
	}
	process_request_queue: {
		options: Record<string, never>
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		sample_action: {
			name: 'My First Action',
			options: [
				{
					id: 'num',
					type: 'number',
					label: 'Test',
					default: 5,
					min: 0,
					max: 100,
				},
			],
			callback: async (event) => {
				console.log('Hello world!', event.options.num)
			},
		},
		print_message: {
			name: 'PRINT: Write to Companion log',
			options: [
				{
					id: 'message',
					type: 'textinput',
					label: 'Message (text or JSON)',
					default: '',
					multiline: true,
					useVariables: true,
				},
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 'INFO',
					choices: [
						{ id: 'DEBUG', label: 'DEBUG' },
						{ id: 'INFO', label: 'INFO' },
						{ id: 'WARN', label: 'WARN' },
						{ id: 'ERROR', label: 'ERROR' },
					],
				},
				{
					id: 'prefix',
					type: 'textinput',
					label: 'Optional prefix',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const message = parsePrintValue(event.options.message)
				printMessage(self.log.bind(self), message, normalizePrintLevel(event.options.level), event.options.prefix)
				self.setVariableValues({ lastPrint: String(event.options.message) })
			},
		},
		set_shared_data: {
			name: 'Shared data: Set value',
			options: [
				{
					id: 'key',
					type: 'textinput',
					label: 'Key',
					default: '',
					useVariables: true,
				},
				{
					id: 'value',
					type: 'textinput',
					label: 'JSON value',
					default: '""',
					multiline: true,
					useVariables: true,
				},
			],
			callback: async (event) => {
				try {
					const value = parseSharedDataValue(event.options.value)
					self.setSharedData(event.options.key, value)
					self.setSharedDataVariables(event.options.key)
				} catch (error) {
					self.log('error', `Shared data: ${error instanceof Error ? error.message : String(error)}`)
				}
			},
		},
		get_shared_data: {
			name: 'Shared data: Get value',
			options: [
				{
					id: 'key',
					type: 'textinput',
					label: 'Key',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				self.setSharedDataVariables(event.options.key)
			},
		},
		has_shared_data: {
			name: 'Shared data: Check key',
			options: [
				{
					id: 'key',
					type: 'textinput',
					label: 'Key',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				self.setSharedDataVariables(event.options.key)
			},
		},
		add_request: {
			name: 'Request queue: Add request',
			options: [
				{
					id: 'request',
					type: 'textinput',
					label: 'Request (JSON object)',
					default: '{"id":"1","shouldSend":true,"action":"PRINT","payload":{"message":"Hello World!"}}',
					multiline: true,
					useVariables: true,
				},
			],
			callback: async (event) => {
				try {
					const input = parseQueueRequest(event.options.request)
					self.addRequest(input)
					self.refreshAdvancedVariables()
				} catch (error) {
					self.log('error', `Request queue: ${error instanceof Error ? error.message : String(error)}`)
				}
			},
		},
		find_request: {
			name: 'Request queue: Find request',
			options: [
				{
					id: 'id',
					type: 'textinput',
					label: 'Request ID',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const request = self.findRequest(event.options.id)
				self.setVariableValues({
					requestFound: request ? 'true' : 'false',
					requestValue: request ? JSON.stringify(request, null, 2) : '',
				})
			},
		},
		check_request_queue: {
			name: 'Request queue: Check ready and pending',
			options: [],
			callback: async () => {
				self.refreshAdvancedVariables()
			},
		},
		process_request_queue: {
			name: 'Request queue: Process ready requests',
			options: [],
			callback: async () => {
				const result = await self.processRequests()
				self.refreshAdvancedVariables()
				for (const failure of result.failures) {
					self.log('error', `Request queue: request "${failure.id}" failed: ${failure.message}`)
				}
				self.log(
					result.failed > 0 ? 'warn' : 'info',
					`Request queue: ${result.processed} completed, ${result.failed} failed${result.skipped ? ', processing already in progress' : ''}.`,
				)
			},
		},
	})
}
