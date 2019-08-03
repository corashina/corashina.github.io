import React from 'react'
import { FaEnvelope, FaFile, FaTwitter, FaStackOverflow, FaGithub, FaLinkedin} from 'react-icons/fa'
import Layout from '../components/Layout'

import contactStyle from '../components/styles/contact.module.scss'
import sectionStyle from '../components/styles/section.module.scss'

export default ({ location }) => (
  <Layout location={location}>
    <h1>Contact</h1>
    <div className={sectionStyle.section}>
      <div>
        <h2>find me</h2>
        <ul className={contactStyle.contact}>
          <li>
            <a href="mailto:contact@tomasz-zielinski.com">
              <FaEnvelope />
              contact@tomasz-zielinski.com
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
          hi
        </p>
      </div>
    </div>
  </Layout>
);
