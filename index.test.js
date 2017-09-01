/* eslint-disable no-use-extend-native/no-use-extend-native */

import Promise from 'bluebird';

import test from 'ava';
import {spy} from 'sinon';

import {
	StateMachine,

	InvalidOptionsError,
	UnknownStateError
} from '.';

test('[a -> b] sync noop transitioning', t => {
	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		transitions: {
			a: {
				b: true
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	s.go('b');

	t.is(s.state(), 'b');
	t.false(s.isBusy());
});

test('[a -> b] sync transitioning with transition function', t => {
	const expectedArgs = [1, 2, 3];

	const ab = spy((...actualArgs) => {
		t.true(s.isBusy()); // eslint-disable-line no-use-before-define
		t.deepEqual(actualArgs, expectedArgs);
	});

	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		transitions: {
			a: {
				b: ab
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	s.go('b', ...expectedArgs);

	t.true(ab.calledOnce);

	t.is(s.state(), 'b');
	t.false(s.isBusy());
});

test('[a -> b] failed sync transitioning', t => {
	const expectedError = new Error('kek');

	const ab = spy(() => {
		throw expectedError;
	});

	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		transitions: {
			a: {
				b: ab
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const actualError = t.throws(() => s.go('b'));

	t.is(actualError, expectedError);
	t.true(ab.calledOnce);

	t.is(s.state(), 'a');
	t.false(s.isBusy());
});

test('[a -> b] failed async transitioning', async t => {
	const expectedError = new Error('kek');

	const ab = spy(() => {
		return Promise.reject(expectedError);
	});

	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		transitions: {
			a: {
				b: ab
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const actualError = await t.throws(s.go('b'));

	t.is(actualError, expectedError);
	t.true(ab.calledOnce);

	t.is(s.state(), 'a');
	t.false(s.isBusy());
});

test('[a -> b] async transitioning', async t => {
	const expectedArgs = [1, 2, 3];
	const expectedReturn = {};

	const ab = spy((...actualArgs) => {
		t.true(s.isBusy()); // eslint-disable-line no-use-before-define
		t.deepEqual(actualArgs, expectedArgs);
		return Promise.resolve(expectedReturn).delay(100);
	});

	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		transitions: {
			a: {
				b: ab
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const ret = await s.go('b', ...expectedArgs);

	t.is(ret, expectedReturn);
	t.true(ab.calledOnce);

	t.is(s.state(), 'b');
	t.false(s.isBusy());
});

test('no states', t => {
	t.throws(() => new StateMachine(), InvalidOptionsError);
});

test('go to unknown state', t => {
	const s = new StateMachine({
		states: ['a'],
		transitions: {
			a: {
				a: true
			}
		}
	});

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);

	t.throws(() => s.go('x'), UnknownStateError);

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);
});

test('explicit initial state', t => {
	const s = new StateMachine({
		states: ['a', 'b'],
		initial: 'b',
		transitions: {
			b: {
				a: true
			}
		}
	});

	t.is(s.state(), 'b');
	t.is(s.isBusy(), false);
});

test('unknown state referenced in transitions', t => {
	t.throws(() => new StateMachine({
		states: ['a'],
		transitions: {
			a: {
				b: true
			}
		}
	}), InvalidOptionsError);
});
