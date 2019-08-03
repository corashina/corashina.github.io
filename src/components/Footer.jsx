import React from 'react'

import styles from './styles/footer.module.scss'

export default function Footer() {
    return (
    <div className={styles.footer}>
      <p>
        Copyright &copy; {new Date().getFullYear()} Tomasz Zielinski
      </p>
    </div>
    )
}
