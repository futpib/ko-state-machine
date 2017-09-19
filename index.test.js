/* eslint-disable no-use-extend-native/no-use-extend-native */

import _ from 'lodash';
import Promise from 'bluebird';

import test from 'ava';
import {spy} from 'sinon';

import {
	StateMachine,

	InvalidOptionsError,
	ConcurrentTransitionError,
	UnknownStateError,
	UnknownArrowError,
	ArrowNotAvailableError
} from '.';

const validOptions = {
	states: ['a', 'b'],
	arrows: ['ab'],
	transitions: {
		a: {
			b: {
				ab: true
			}
		}
	}
};

test('[a -> b] sync noop transitioning', t => {
	const s = new StateMachine({
		states: [
			'a',
			'b'
		],
		arrows: [
			'ab'
		],
		transitions: {
			a: {
				b: {
					ab: true
				}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	s.go('ab', 'b');

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
		arrows: [
			'ab'
		],
		transitions: {
			a: {
				b: {ab}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	s.go('ab', 'b', ...expectedArgs);

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
		arrows: [
			'ab'
		],
		transitions: {
			a: {
				b: {ab}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const actualError = t.throws(() => s.go('ab', 'b'));

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
		arrows: [
			'ab'
		],
		transitions: {
			a: {
				b: {ab}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const actualError = await t.throws(s.go('ab', 'b'));

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
		arrows: [
			'ab'
		],
		transitions: {
			a: {
				b: {ab}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	const ret = await s.go('ab', 'b', ...expectedArgs);

	t.is(ret, expectedReturn);
	t.true(ab.calledOnce);

	t.is(s.state(), 'b');
	t.false(s.isBusy());
});

test('arrow availability', t => {
	const expectedArgs = [1, 2, 3];

	let isAvailable;

	const available = spy((...args) => {
		t.deepEqual(args, expectedArgs);
		return isAvailable;
	});

	const transition = spy((...args) => {
		t.deepEqual(args, expectedArgs);
	});

	const s = new StateMachine({
		states: ['a'],
		arrows: ['aa'],
		transitions: {
			a: {
				a: {
					aa: {
						available,
						transition
					}
				}
			}
		}
	});

	t.is(s.state(), 'a');
	t.false(s.isBusy());

	available.reset();
	transition.reset();
	isAvailable = true;

	t.true(s.canGo('aa', 'a', ...expectedArgs));
	t.true(available.calledOnce);
	t.false(transition.called);
	s.go('aa', 'a', ...expectedArgs);
	t.is(available.callCount, 2);
	t.true(transition.calledOnce);

	available.reset();
	transition.reset();
	isAvailable = false;

	t.false(s.canGo('aa', 'a', ...expectedArgs));
	t.true(available.calledOnce);
	t.false(transition.called);
	t.throws(() => s.go('aa', 'a', ...expectedArgs), ArrowNotAvailableError);
	t.is(available.callCount, 2);
	t.false(transition.called);

	t.is(s.state(), 'a');
	t.false(s.isBusy());
});

test('error on unknown transition', t => {
	const s = new StateMachine({
		states: ['a'],
		arrows: ['aa'],
		transitions: {
			a: {
				a: {
					aa: true
				}
			}
		}
	});

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);

	t.throws(() => s.go('ab', 'a'), UnknownArrowError);

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);

	t.throws(() => s.go('aa', 'b'), UnknownStateError);

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);
});

test('error on concurrent transition', async t => {
	const forever = new Promise(_.noop);

	const s = new StateMachine({
		states: ['a'],
		arrows: ['aa'],
		transitions: {
			a: {
				a: {
					aa: () => forever
				}
			}
		}
	});

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);

	s.go('aa', 'a');

	t.is(s.state(), 'a');
	t.is(s.isBusy(), true);

	await t.throws(() => s.go('aa', 'a'), ConcurrentTransitionError);

	t.is(s.state(), 'a');
	t.is(s.isBusy(), true);
});

test('explicit initial state', t => {
	const s = new StateMachine({
		states: ['a', 'b'],
		arrows: ['ba'],
		initial: 'b',
		transitions: {
			b: {
				a: {
					ba: true
				}
			}
		}
	});

	t.is(s.state(), 'b');
	t.is(s.isBusy(), false);
});

test('no options', t => {
	t.throws(() => new StateMachine(), InvalidOptionsError);
});

test('valid options', t => {
	t.notThrows(() => new StateMachine(validOptions));
});

test('no states', t => {
	t.throws(() => new StateMachine(_.omit(validOptions, 'states')), InvalidOptionsError);
});

test('no arrows', t => {
	t.throws(() => new StateMachine(_.omit(validOptions, 'arrows')), InvalidOptionsError);
});

test('no transitions', t => {
	t.throws(() => new StateMachine(_.omit(validOptions, 'transitions')), InvalidOptionsError);
});

test('unknown initial', t => {
	t.throws(() => new StateMachine(_.defaults({
		initial: 'foo'
	}, validOptions)), UnknownStateError);
});

test('invalid arrow', t => {
	const s = new StateMachine({
		states: ['a', 'b'],
		arrows: ['ba'],
		initial: 'b',
		transitions: {
			b: {
				a: {
					ba: {}
				}
			}
		}
	});

	t.throws(() => s.go('ba', 'a'), TypeError);
});

test('`canGo` no target states', t => {
	const s = new StateMachine({
		states: [
			's',
			'a'
		],
		arrows: ['arrow'],
		transitions: {
			s: {}
		}
	});

	t.false(s.canGo('arrow', 'a'));
});

test('`canGo` no arrows', t => {
	const s = new StateMachine({
		states: [
			's',
			'a'
		],
		arrows: ['arrow'],
		transitions: {
			s: {
				a: {}
			}
		}
	});

	t.false(s.canGo('arrow', 'a'));
});

test('`canGo` while transitioning', t => {
	const forever = new Promise(_.noop);

	const s = new StateMachine({
		states: ['a'],
		arrows: ['aa'],
		transitions: {
			a: {
				a: {
					aa: () => forever
				}
			}
		}
	});

	t.is(s.state(), 'a');
	t.is(s.isBusy(), false);

	s.go('aa', 'a');

	t.is(s.state(), 'a');
	t.is(s.isBusy(), true);

	t.false(s.canGo('aa', 'a'));

	t.is(s.state(), 'a');
	t.is(s.isBusy(), true);
});

test('`canGo` exhaustive', t => {
	const s = new StateMachine({
		states: [
			's',
			'a',
			'b',
			'c'
		],
		arrows: ['arrow'],
		transitions: {
			s: {
				a: {
					arrow: true
				},
				c: {
					arrow: {
						available: () => false,
						transition: () => {}
					}
				}
			}
		}
	});

	const can = (...args) => t.true(s.canGo(...args));
	const cant = (...args) => t.false(s.canGo(...args));
	const throws = (...args) => t.throws(() => s.canGo(...args));

	throws('arrow', 'u');
	throws('u', 'a');
	can('arrow', 'a');
	cant('arrow', 'b');
	cant('arrow', 'c');
});
