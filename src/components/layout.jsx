import React from 'react'
import Helmet from 'react-helmet'
import Nav from './Nav'
import Footer from './Footer'

export default ({ children, location, title, width }) => {

  const style = width ? { maxWidth: `${width}px` } : {};
  return (
    <div className='layout' style={style}>
      <Helmet title={location.pathname.slice(1, -1)}>
        <meta name='description' title={title} content='Tomasz Zielinski Portfolio Website' />
      </Helmet>
      <Nav location={location} />
      <div className='content'>{children}</div>
      <Footer />
    </div>
  );
};
