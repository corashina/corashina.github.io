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
            <a href="mailto:contact@zielin.ski">
              <FaEnvelope />
              contact@zielin.ski
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
            <a href="https://github.com/corashina">
              <FaGithub />
              github <span>github.com/corashina</span>
            </a>
          </li>
          <li>
            <a href="https://stackoverflow.com/users/7306664/corashina?tab=profile">
              <FaStackOverflow />
              stack overflow <span>stackoverflow.com/corashina</span>
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
      
        <br />
        <br />
      
        <a className={contactStyle.flair} href="https://stackexchange.com/users/9864859">
          <img src={`https://stackexchange.com/users/flair/9864859.png?theme=default`} width="208" height="58" alt="profile for corashina on Stack Exchange, a network of free, community-driven Q&amp;A sites" title="profile for corashina on Stack Exchange, a network of free, community-driven Q&amp;A sites"/>
        </a>

      </div>
    </div>
  </Layout>
);
