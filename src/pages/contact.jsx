import React from 'react'

import Layout from '../components/layout'

import { FaGithub, FaStackOverflow, FaLinkedin, FaTwitter, FaEnvelope, FaPhone, FaFile } from 'react-icons/fa'

export default function Contact() {
    return (
        <Layout>
            <h2 className="contact-text">
                Hire <span>?</span>
            </h2>
            <p className="contact-text">
                Looking for hand-crafted, interactive 3D experiences for your website or product? I'm
                available for freelance and consulting work.
            </p>
            <ul>
                <li>
                    <a href="https://github.com/Tomasz-Zielinski">
                        <FaGithub />
                        Github
                    </a>
                </li>
                                <li>
                    <a href="https://stackoverflow.com/users/7306664/tomasz-zieli%C5%84ski">
                        <FaStackOverflow />
                        Stack Overflow
                    </a>
                </li>
                <li>
                    <a href="https://www.linkedin.com/in/tomasz-zielinski-a97999161">
                        <FaLinkedin />
                        LinkedIn
                    </a>
                </li>
                <li>
                    <a href="https://twitter.com/Asaris11">
                        <FaTwitter />
                        Twitter
                    </a>
                </li>
                <li>
                    <a href="mailto:nowhere@mozilla.org">
                        <FaEnvelope />
                        contact@tomasz-zielinski.com
                    </a>
                </li>
                <li>
                    <a href="./tomasz_zielinski.pdf">
                        <FaFile />
                        download resume
                    </a>
                </li>
                <li>
                    <a>
                        <FaPhone />
                        07519554924
                    </a>
                </li>
            </ul>

        </Layout>
    )
}

