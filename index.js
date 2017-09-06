/* eslint-disable unicorn/custom-error-definition */

const _ = require('lodash');

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

class ConcurrentTransitionError extends StateMachineError {}

class UnreachableStateError extends StateMachineError {}

class UnknownStateError extends UnreachableStateError {}

class UnknownArrowError extends UnreachableStateError {}

class NoArrowsError extends UnreachableStateError {}

class ArrowNotAvailableError extends NoArrowsError {}

class StateMachine {
	constructor(options) {
		options = Object.assign({}, options);

		if (!options.states || _.isEmpty(options.states)) {
			throw new InvalidOptionsError('`states` options is required');
		}

		if (!options.arrows || _.isEmpty(options.arrows)) {
			throw new InvalidOptionsError('`arrows` options is required');
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
		this._arrows = options.arrows;
		this._initial = options.initial;
		this._transitions = options.transitions;

		this._state = ko.observable(this._initial);
		this._currentTransition = ko.observable(null);
	}

	state() {
		return this._state();
	}

	isBusy() {
		return Boolean(this._currentTransition());
	}

	_evaluateArrow(arrow, ...args) {
		if (arrow === true) {
			return;
		}

		if (typeof arrow === 'function') {
			return arrow(...args);
		}

		if (typeof arrow === 'object') {
			return arrow.transition(...args);
		}

		throw new TypeError('Expected transition function, `{transition}` or `true`, instead got ' + arrow);
	}

	_dryGo(targetArrow, targetState, callback, ...args) {
		if (!this._states.includes(targetState)) {
			throw new UnknownStateError([
				'Can\'t go to unknown state `',
				targetState,
				'`'
			], {
				targetState,
				states: this._states
			});
		}

		if (!this._arrows.includes(targetArrow)) {
			throw new UnknownArrowError([
				'Can\'t perform transition via unknown arrow `',
				targetArrow,
				'`'
			], {
				targetArrow,
				arrows: this._arrows
			});
		}

		const currentTransition = this._currentTransition();
		if (currentTransition) {
			const {
				targetArrow: currentTargetArrow, targetState: currentTargetState
			} = currentTransition;

			throw new ConcurrentTransitionError([
				'Attempted transition to`',
				targetState,
				'` via `',
				targetArrow,
				'` while already transitioning to`',
				currentTargetState,
				'` via `',
				currentTargetArrow,
				'`'
			], {
				targetState,
				targetArrow,
				currentTargetArrow,
				currentTargetState
			});
		}

		const currentState = this._state();
		const definedTargetStates = this._transitions[currentState];

		if (!definedTargetStates || _.isEmpty(definedTargetStates)) {
			throw new NoArrowsError([
				'No states are defined to be reachable from`',
				currentState,
				'`'
			], {
				currentState
			});
		}

		const definedArrows = definedTargetStates && definedTargetStates[targetState];

		if (!definedArrows || _.isEmpty(definedArrows)) {
			throw new NoArrowsError([
				'No arrows defined from`',
				currentState,
				'` to `',
				targetState,
				'`'
			], {
				targetState,
				currentState
			});
		}

		const arrow = definedArrows && definedArrows[targetArrow];

		const isAvailable = !arrow.available || arrow.available(...args);
		if (!isAvailable) {
			throw new ArrowNotAvailableError('Arrow was not available', {
				arrow
			});
		}

		return callback(targetArrow, targetState, arrow, ...args);
	}

	canGo(targetArrow, targetState, ...canGoArgs) {
		try {
			return this._dryGo(targetArrow, targetState, (targetArrow, targetState, arrow) => {
				return Boolean(arrow);
			}, ...canGoArgs);
		} catch (err) {
			if (err instanceof ArrowNotAvailableError) {
				return false;
			}
			throw err;
		}
	}

	go(targetArrow, targetState, ...goArgs) {
		return this._dryGo(targetArrow, targetState, (targetArrow, targetState, arrow, ...args) => {
			this._currentTransition({
				targetState,
				targetArrow
			});

			let transitionResult;
			let transitionResultIsThenable;
			let transitionError;

			try {
				transitionResult = this._evaluateArrow(arrow, ...args);
				transitionResultIsThenable = transitionResult && typeof transitionResult.then === 'function';
			} catch (err) {
				transitionError = err;
			}

			const resolved = ret => {
				this._state(targetState);
				this._currentTransition(null);
				return ret;
			};

			const rejected = err => {
				this._currentTransition(null);
				throw err;
			};

			if (transitionResultIsThenable) {
				return transitionResult.then(resolved, rejected);
			} else if (transitionError) {
				rejected(transitionError);
			} else {
				return resolved(transitionResult);
			}
		}, ...goArgs);
	}
}

module.exports = {
	StateMachine,

	StateMachineError,

	InvalidOptionsError,
	ConcurrentTransitionError,
	UnreachableStateError,
	UnknownStateError,
	UnknownArrowError,
	NoArrowsError,
	ArrowNotAvailableError
};
