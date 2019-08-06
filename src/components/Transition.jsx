import React from 'react'
import { TransitionGroup, Transition as CanvasTransition} from 'react-transition-group'
import './styles/transition.scss'
import { duration, state } from './utils/states'

const triggerTransition = () => window.canvas.triggerTransition(duration * 2)

class Transition extends React.Component {
  constructor(props) {
    super(props);

    this.isBackward = false
    this.timeoutId = undefined

    this.startBackward = () => {
      this.isBackward = true;
      window.canvas._transitionIsBackward = true;

      // in case user clicks back quicker than duration
      // we need to cancel the previous unresolved timeout
      if (this.timeoutId) clearTimeout(this.timeoutId);

      // then, sets timeout to reset isBackward state
      this.timeoutId = setTimeout(() => window.canvas._transitionIsBackward = false, duration * 2);
    };

    this.endBackward = () => this.isBackward = false

    if(typeof window !== "undefined" && window.history && window.history.pushState) {
      window.addEventListener("popstate", this.startBackward);
    }
  }

  render() {
    const { location, children } = this.props;

    return (
      <TransitionGroup>
        <CanvasTransition
          key={location.pathname}
          timeout={{ enter: duration, exit: duration }}
          onExited={this.endBackward}
          onExit={triggerTransition}
        >
          {(status) => {
            return (
              <div
                style={{ ...state(status, this.isBackward) }}
                className="transition"
              >
                {children}
              </div>
            );
          }}
        </CanvasTransition>
      </TransitionGroup>
    );
  }
}

export default Transition;
