import assert from 'node:assert/strict'
import test from 'node:test'
/* eslint-disable n/no-unpublished-import -- Tests run after compiling dist. */
import {
	formatLogValue,
	normalizePrintLevel,
	parsePrintValue,
	parseQueueRequest,
	parseSharedDataValue,
	printMessage,
	RequestQueue,
} from '../dist/services/advancedExpressions.js'
/* eslint-enable n/no-unpublished-import */

test('PRINT formats plain strings and structured values through the selected log level', () => {
	const lines = []
	printMessage((level, message) => lines.push({ level, message }), { items: [1, true] }, 'WARN', 'System')

	assert.deepEqual(lines, [{ level: 'warn', message: '[System] {\n  "items": [\n    1,\n    true\n  ]\n}' }])
	assert.equal(parsePrintValue('hello'), 'hello')
	assert.deepEqual(parsePrintValue('[1,2]'), [1, 2])
})

test('PRINT safely formats circular values and normalizes invalid levels', () => {
	const circular = {}
	circular.self = circular

	assert.match(formatLogValue(circular), /\[Circular\]/)
	assert.equal(normalizePrintLevel('error'), 'ERROR')
	assert.equal(normalizePrintLevel('not-a-level'), 'INFO')
})

test('shared data accepts supported JSON values and rejects null or invalid JSON', () => {
	assert.equal(parseSharedDataValue('"text"'), 'text')
	assert.equal(parseSharedDataValue('12'), 12)
	assert.equal(parseSharedDataValue('false'), false)
	assert.deepEqual(parseSharedDataValue('{"items":[1,"two"]}'), { items: [1, 'two'] })
	assert.throws(() => parseSharedDataValue('null'), /JSON string, number, Boolean, array, or object/)
	assert.throws(() => parseSharedDataValue('{broken'), /valid JSON/)
})

test('queue processes ready requests once and records failed requests', async () => {
	const queue = new RequestQueue()
	queue.add(parseQueueRequest('{"id":1,"shouldSend":true,"action":"PRINT","payload":{"message":"ok"}}'))
	queue.add(parseQueueRequest('{"id":"later","shouldSend":false,"action":"PRINT","payload":{"message":"skip"}}'))
	queue.add(parseQueueRequest('{"id":"bad","shouldSend":true,"action":"UNKNOWN","payload":{}}'))

	const seen = []
	const result = await queue.processReady(async (request) => {
		seen.push(request.id)
		if (request.action === 'UNKNOWN') throw new Error('unsupported')
	})

	assert.deepEqual(seen, ['1', 'bad'])
	assert.equal(result.processed, 1)
	assert.equal(result.failed, 1)
	assert.deepEqual(result.failures, [{ id: 'bad', message: 'unsupported' }])
	assert.equal(queue.find('1')?.status, 'completed')
	assert.equal(queue.find('bad')?.error, 'unsupported')
	assert.equal(queue.find('later')?.status, 'pending')
	assert.equal(queue.getReadyCount(), 0)
	assert.throws(
		() => queue.add(parseQueueRequest('{"id":1,"shouldSend":true,"action":"PRINT","payload":{}}')),
		/already exists/,
	)

	const secondPass = await queue.processReady(async () => {
		assert.fail('completed and failed requests must not be processed again')
	})
	assert.equal(secondPass.processed, 0)
	assert.equal(secondPass.failed, 0)
})

test('a concurrent queue processing attempt is skipped', async () => {
	const queue = new RequestQueue()
	queue.add(parseQueueRequest('{"id":"one","shouldSend":true,"action":"PRINT","payload":{}}'))

	let unblock
	const processing = queue.processReady(
		() =>
			new Promise((resolve) => {
				unblock = resolve
			}),
	)
	const concurrent = await queue.processReady(async () => {
		assert.fail('the same request must not be processed concurrently')
	})
	assert.equal(concurrent.skipped, true)

	unblock()
	assert.equal((await processing).processed, 1)
})
