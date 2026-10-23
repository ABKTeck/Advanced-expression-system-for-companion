import type ModuleInstance from './main.js'

export type VariablesSchema = {
	variable1: string
	variable2: string
	variable3: string
	lastPrint: string
	sharedDataKey: string
	sharedDataValue: string
	sharedDataExists: string
	requestQueueReady: string
	requestQueuePending: string
	requestFound: string
	requestValue: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		variable1: { name: 'My first variable' },
		variable2: { name: 'My second variable' },
		variable3: { name: 'Another variable' },
		lastPrint: { name: 'Advanced Expressions: last printed message' },
		sharedDataKey: { name: 'Advanced Expressions: shared data key' },
		sharedDataValue: { name: 'Advanced Expressions: shared data value (JSON)' },
		sharedDataExists: { name: 'Advanced Expressions: shared data key exists' },
		requestQueueReady: { name: 'Advanced Expressions: ready request count' },
		requestQueuePending: { name: 'Advanced Expressions: pending request count' },
		requestFound: { name: 'Advanced Expressions: request found' },
		requestValue: { name: 'Advanced Expressions: request details (JSON)' },
	})
}
