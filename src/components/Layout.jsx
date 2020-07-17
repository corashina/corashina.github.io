import React from 'react'
import Helmet from 'react-helmet'
import Nav from './Nav'
import Footer from './Footer'

import styles from './styles/layout.module.scss'

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default ({ children, location, title, width }) => {
  const path = location.pathname.split('/').filter(e => e !== '').pop() || 'Home'
  return (
    <div className={styles.layout} style={{'maxWidth': `${width}px`}}>
      <Helmet title={capitalizeFirstLetter(path)}>
        <meta name="description" content='Tomasz Zielinski Portfolio Website' />
      </Helmet>
      <Nav location={location} />
      <div className="content">{children}</div>
      <Footer />
    </div>
  );
};
