import React from 'react'
<<<<<<< HEAD
import { FaEnvelope, FaFile, FaTwitter, FaPhone, FaStackOverflow, FaGithub, FaLinkedin} from 'react-icons/fa'
import Layout from '../components/Layout'

export default ({ location }) => (
  <Layout location={location}>
    <h1>Contact</h1>
    <div className="layout23">
      <div>
        <h2>find me</h2>
        <ul className="contact">
          <li>
            <a href="mailto:contact@tomasz-zielinski.com">
              <FaEnvelope />
              contact@tomasz-zielinski.com
            </a>
          </li>
          <li>
            <a>
              <FaPhone />
              (+44) 07519554924
            </a>
          </li>
          <li>
            <a href="/tomasz_zielinski.pdf">
              <FaFile />
              resume
            </a>
          </li>
          <br />
          <li>
            <a href="https://github.com/Tomasz-Zielinski">
              <FaGithub />
              github <span>github.com/tomasz-zielinski</span>
            </a>
          </li>
          <li>
            <a href="https://stackoverflow.com/users/7306664/tomasz-zieli%C5%84ski">
              <FaStackOverflow />
              stack overflow <span>stackoverflow.com/tomasz-zielinski</span>
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/tomasz-zielinski-a97999161/">
              <FaLinkedin />
              linkedin <span>linkedin.com/in/tomasz-zielinski</span>
            </a>
          </li>
          <li>
            <a href="http://twitter.com/corashina">
              <FaTwitter />
              twitter <span>twitter.com/corashina</span>
            </a>
          </li>
        </ul>
      </div>
      <div>
        <h2>see also</h2>
        <p>
          <a href="http://old.iamnop.com/">old website</a>
        </p>
      </div>
    </div>
  </Layout>
);
=======

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

>>>>>>> 101dd8b6c8c9a0f181e173cb2b67ecda2e858cad
