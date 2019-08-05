import React from "react";
import { Link, graphql } from "gatsby";
import Layout from "../components/Layout";
import WorkItem from "../components/WorkItem";

import styles from '../components/styles/section.module.scss'

export default ({ location, data }) => {

  const introSection = (
    <div className="section">
      <h1>Tomasz Zielinski</h1>
      <div className={styles.section}>
        <div>
          <h2>an aspiring software engineer</h2>
          <p>
            My name is Tomasz, I 'm an aspiring web engineer. I started to pursue the career of a web
            developer 3 years ago.I moved to United Kingdom in 2017 to study computer science and develop my
            passions on the University of Southampton.I love making things, especially pretty 3 D graphics with
            code.
          </p>
          <p>
            I use a lot of different tools to accomplish my goals.Most of them are popular web technologies and
            frameworks, although I enjoy learning and making stuff with other languages like C++, Java and
            GLSL.
          </p>
        </div>
        <div>
          <h2>i use</h2>
          <p>
            html
            <br />
            css
            <br />
            javascript
            <br />
            threejs
            <br />
            <br />
            react
            <br />
            redux
            <br />
            gatsby
            <br />
            <br />
            graphql
            <br />
            node
            <br />
            <br />
            mongodb
            <br />
            postgres
            <br />
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <Layout location={location}>
      {introSection}
    </Layout>
  );
};
