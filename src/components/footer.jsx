import React from 'react'


export default function Footer({ children }) {
    return (
        <p>Copyright <span className="copyright-sign">&#9400;</span>
            <span className="copyright-date">{new Date().getFullYear()}</span> Tomasz Zielinski
        </p>
    )
}
