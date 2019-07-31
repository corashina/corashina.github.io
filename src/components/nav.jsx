import React from 'react'
import AniLink from 'gatsby-plugin-transition-link/AniLink'
import styles from './styles/nav.module.scss'
import { jsx } from 'theme-ui'

export default function Nav() {
    return (
        <nav  className={styles.nav}>
        <p sx={{color: "background"}}></p>
            <AniLink sx={{color: "background"}} fade to="/">Home</AniLink>
            <AniLink fade to="/work">Work</AniLink>
            <AniLink fade to="/contact">Contact</AniLink>
        </nav>
    )
}
