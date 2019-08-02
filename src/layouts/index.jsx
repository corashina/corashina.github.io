import React from 'react'
import Canvas from '../components/Canvas'
import Transition from '../components/Transition'

export default ({ children, location }) => (
  <div>
    <Canvas />
    <Transition location={location}>{children}</Transition>
  </div>
);
