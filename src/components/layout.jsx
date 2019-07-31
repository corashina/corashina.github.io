import React from 'react'

import Nav from '../components/nav'
import Canvas from '../components/canvas'
import Footer from '../components/footer'

import styles from './styles/layout.module.scss'

export default function Layout({ children }) {
   
    return (
        <div className={styles.layout}>
            <Canvas />
            <Nav />
            {children}
            <Footer />
        </div>
    )
}
