
const ko = require('knockout');

const Error = require('es6-error');

class StateMachineError extends Error {
	constructor(message, info) {
		if (Array.isArray(message)) {
			message = message.join('');
		}
		super(message);
		Object.assign(this, info);
	}
}

class InvalidOptionsError extends StateMachineError {}

class ConcurrentTransitioningError extends StateMachineError {}

class UnreachableStateError extends StateMachineError {}

class UnknownStateError extends UnreachableStateError {}

class NoTransitionsError extends UnreachableStateError {}

class StateMachine {
	constructor(options) {
		options = Object.assign({}, options);

		if (!options.states || !options.states.length) {
			throw new InvalidOptionsError('`states` options is required');
		}

		if (!options.initial) {
			options.initial = options.states[0];
		}

		if (!options.states.includes(options.initial)) {
			throw new UnknownStateError('`initial` option references unknown state: ' + options.initial, {
				target: options.initial,
				states: options.states
			});
		}

		if (!options.transitions) {
			throw new InvalidOptionsError('`transitions` options is required');
		}

		this._states = options.states;
		this._initial = options.initial;
		this._transitions = options.transitions;

		this._state = ko.observable(this._initial);
		this._transitioning = ko.observable(null);
	}

	state() {
		return this._state();
	}

	isBusy() {
		return Boolean(this._transitioning());
	}

	_evaluateTransition(transition, ...args) {
		if (transition === true) {
			return;
		}

		if (typeof transition === 'function') {
			return transition(...args);
		}

		throw new TypeError('Expected transition function or `true`, instead got ' + transition);
	}

	go(target, ...args) {
		if (!this._states.includes(target)) {
			throw new UnknownStateError([
				'Can\'t go to unknown state `',
				target,
				'`'
			], {
				target,
				states: this._states
			});
		}

		const transitioning = this._transitioning();
		if (transitioning) {
			throw new ConcurrentTransitioningError([
				'Attempted transition to `',
				target,
				'` while already transitioning to`',
				transitioning,
				'`'
			], {
				target,
				transitioning
			});
		}

		const state = this._state();
		const availableTransitions = this._transitions[state];
		const transition = availableTransitions && availableTransitions[target];

		if (!transition) {
			throw new NoTransitionsError([
				'No transitions defined from`',
				state,
				'` to `',
				target,
				'`'
			], {
				target,
				state,
				availableTransitions
			});
		}

		this._transitioning(target);
		let transitionResult;
		let transitionResultIsThenable;
		let transitionError;

		try {
			transitionResult = this._evaluateTransition(transition, ...args);
			transitionResultIsThenable = transitionResult && typeof transitionResult.then === 'function';
		} catch (err) {
			transitionError = err;
		}

		const resolved = ret => {
			this._state(target);
			this._transitioning(null);
			return ret;
		};

		const rejected = err => {
			this._transitioning(null);
			throw err;
		};

		if (transitionResultIsThenable) {
			return transitionResult.then(resolved, rejected);
		} else if (transitionError) {
			rejected(transitionError);
		} else {
			return resolved(transitionResult);
		}
	}
}

module.exports = {
	StateMachine,

	StateMachineError,
	ConcurrentTransitioningError,
	UnreachableStateError,
	UnknownStateError,
	NoTransitionsError
};
