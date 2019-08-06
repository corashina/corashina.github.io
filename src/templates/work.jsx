import React, { Component } from 'react'
import { Link, graphql } from 'gatsby'
import Layout from '../components/Layout'

export default class work extends Component {
    constructor(props) {
        super(props)

        this.handleMouseOver = this.handleMouseOver.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)
        this.work = props.data.worksJson
    }
    handleMouseOver(e) {
        e.preventDefault()
        this.refs.video.play()
    }
    handleMouseOut(e) {
        e.preventDefault()
        this.refs.video.pause()
        this.currentTime = 0
    }
    render() {
        const elem = this.work.url.includes('mp4') ? (
            <video
                ref='video'
                loop
                onMouseOver={this.handleMouseOver}
                onMouseOut={this.handleMouseOut}
            >
                <source
                    src={this.work.url.includes('http') ? this.work.url : `/portfolio/${this.work.url}`}
                    type='video/mp4'
                />
                <p>Your browser doesn't support HTML5 video</p>
            </video>
        ) : (
            <img
                className='image'
                src={this.work.url.includes('http') ? this.work.url : `/portfolio/${this.work.url}`}
            />
        )

        return (
            <Layout
                location={this.props.location}
                title={this.work.title}
                width={900}
            >
                <div className='work'>
                    {elem}
                    <div>
                        <h2>{this.work.title}</h2>
                        <h4>{this.work.date}</h4>
                        <p>{this.work.description}</p>

                        <br />

                        <ul className='tools'>
                            {this.work.tools.map(tool => (
                                <li key={tool}>{tool}</li>
                            ))}
                        </ul>

                        <br />

                        <a href={this.work.link}>github →</a>

                    </div>
                </div>
            </Layout>
        )
    }
}

export const pageQuery = graphql`
    query WorkBySlug($slug: String!) {
        worksJson(fields: { slug: { eq: $slug } }) {
            title
            description
            tools
            date
            url
            link
        }
    }
`
