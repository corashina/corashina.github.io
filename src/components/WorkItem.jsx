import React, { Component } from 'react'
import { Link } from 'gatsby'

const getUrl = (url) => url.includes("http") ? url : `/portfolio/${url}`

export default class WorkItem extends Component {
    constructor(props) {
        super(props)
        this.handleMouseOver = this.handleMouseOver.bind(this)
        this.handleMouseOut = this.handleMouseOut.bind(this)
    }
    handleMouseOver(e) {
        this.refs.video.play()
        console.log(this.refs.video.style)
    }
    handleMouseOut(e) {
        this.refs.video.pause() 
        this.currentTime=0
    }
    render() {
        return (
            <Link to={this.props.slug}>
                <div>
                    <video ref='video' loop onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
                        <source  src={getUrl(this.props.url)} type="video/mp4"/>
                        <p>Your browser doesn't support HTML5 video</p>
                    </video> 
                </div>
                <div>{this.props.title}</div>
            </Link>
        )
    }
}
