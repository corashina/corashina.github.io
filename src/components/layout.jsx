import React from 'react'
import Helmet from 'react-helmet'
import Nav from './Nav'
import Footer from './Footer'

import styles from './styles/layout.module.scss'

export default ({ children, location, title, width }) => {

  const style = width ? { maxWidth: `${width}px` } : {};

  return (
    <div className={styles.layout} style={style}>
      <Helmet title={location.pathname.split('/').pop()}>
        <meta name='description' title={title} content='Tomasz Zielinski Portfolio Website' />
      </Helmet>
      <Nav location={location} />
      <div className='content'>{children}</div>
      <Footer />
    </div>
  );
};
