import React from 'react'
import Helmet from 'react-helmet'
import Nav from './Nav'
import styles from './styles/layout.module.scss'

export default ({ children, location, title, width }) => {

  const footer = (
    <div className="footer">
      <p>
        Copyright &copy; {new Date().getFullYear()} Tomasz Zielinski
      </p>
    </div>
  );

  const style = width ? { maxWidth: `${width}px` } : {};
  return (
    <div className={styles.layout} style={style}>
      <Helmet title={location.pathname.slice(1, -1)}>
        <meta name="description" content='Tomasz Zielinski Portfolio Website' />
      </Helmet>
      <Nav location={location} />
      <div className="content">{children}</div>
      {footer}
    </div>
  );
};
