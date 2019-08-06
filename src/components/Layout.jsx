import React from 'react'
import Helmet from 'react-helmet'
import Nav from './Nav'
import Footer from './Footer'

import styles from './styles/layout.module.scss'

export default ({ children, location, title, width }) => {
    
  return (
    <div className={styles.layout} style={{'maxWidth': `${width}px`}}>
      <Helmet title={location.pathname.slice(1, -1)}>
        <meta name="description" content='Tomasz Zielinski Portfolio Website' />
      </Helmet>
      <Nav location={location} />
      <div className="content">{children}</div>
      <Footer />
    </div>
  );
};
