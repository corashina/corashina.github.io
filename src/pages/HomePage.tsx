import { Fragment, type JSX } from "react";
import styles from "../styles/home.module.scss";

const tools = [
  "javascript",
  "typescript",
  "scss",
  "three",
  "",
  "react",
  "redux",
  "gatsby",
  "",
  "node",
  "nosql",
  "mongo",
];

export function HomePage(): JSX.Element {
  return (
    <>
      <h1>Tomasz Zielinski</h1>
      <div className={styles.home}>
        <div>
          <h2>an aspiring software engineer</h2>
          <p>Web enthusiast with experience in software development and architecture. Interested in network programming, web-based architecture, web-based authentication and unix systems. Advocate of fast paced development environments that embrace continuous change. Student at the University of Southampton.</p>
          <p>Accomplishing my goals with a variety of tools, predominantly web stuff such as Javascript, React, Redux, Node. Always ready to grasp new concepts and learn different technologies.</p>
        </div>
        <div className={styles.tools}>
          <h2>i use</h2>
          <p aria-label="Technologies">
            {tools.map((tool, index) => (
              <Fragment key={`${tool}-${index}`}>
                {tool}{" "}
                <br />
              </Fragment>
            ))}
          </p>
        </div>
      </div>
    </>
  );
}
