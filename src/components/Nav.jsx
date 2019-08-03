import React from 'react'
import { Link } from 'gatsby'
import { GoThreeBars, GoX } from 'react-icons/go'
import Theme from './Theme'

class Nav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      expanded: false,
    };
  }

  toggle() {
    this.setState((prevState) => ({ expanded: !prevState.expanded }));
  }

  render() {
    const { location } = this.props;
    const { expanded } = this.state;

    const links = {
      Home: '/',
      Work: '/works',
      Contact: '/contact',
    };
    const menu = (
      <ul>
        {Object.keys(links).map((k) => {
          const v = links[k];
          return (
            <li key={k}>
              {v === location.pathname ? (
                <span>{k}</span>
              ) : (
                <Link to={v}>{k}</Link>
              )}
            </li>
          );
        })}
      </ul>
    );

    let toggleElem;
    let menuElem;
    if (expanded) {
      toggleElem = (
        <GoX className='menu-toggle' onClick={() => this.toggle()} />
      );
      menuElem = <div className='menu-container expanded'>{menu}</div>;
    } else {
      toggleElem = (
        <GoThreeBars className='menu-toggle' onClick={() => this.toggle()} />
      );
      menuElem = <div className='menu-container'>{menu}</div>;
    }

    return (
      <nav className='navbar'>
        <Theme />
        {toggleElem}
        {menuElem}
      </nav>
    );
  }
}

export default Nav;
