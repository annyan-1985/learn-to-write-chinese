import React from 'react'
import { connect }  from 'react-redux'

import { 
    Button, 
    ButtonGroup, 
    Container, 
    Row,
    Col, 
    Modal, 
    ListGroup 
} from 'react-bootstrap'
import { 
    MdDone, 
    MdClose, 
    MdChevronLeft, 
    MdChevronRight, 
    MdFullscreen,
    MdFullscreenExit
} from 'react-icons/md'
import { 
    GiUnicorn, 
    GiSpeaker 
} from 'react-icons/gi'

import { 
    Hanzi, 
    HanziList, 
    RecogniseHistoryItem, 
    RecogniseProgressBar, 
    VoiceText 
} from '..'

import { 
    getNewCharList, 
    getReviewCharList, 
    getQuizCharQueue, 
    getNewListIndex,
    getWrongChars, 
    getRecogniseHistory,
    getSettings
} from '../../model/selectors'
import { 
    prepareRecognise, 
    startRecognise, 
    recognise, 
    changeNew,
} from '../../model/actions'
import { speak } from '../../module/speak'
import {descriptiveWords} from '../../module/words'

import annyang from 'annyang'
import pinyin from 'pinyin'

//import { SpeechKITT } from '../../../node_modules/speechkitt/src/speechkitt'
class SelectView extends React.Component {
    recentRecogniseHistory() {
        let list = []
        if (this.props.recogniseHistory instanceof Array){
            list = list.concat(this.props.recogniseHistory.slice(-5))
        }
        return list.reverse()
    }
    render() {
        return (
            <Container fluid>
                <Row>
                    <Col>
                        <center>
                            <h1>
                                今日生字
                                ({this.props.newListIndex})
                            </h1>
                        </center>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <ButtonGroup className="d-flex">
                            <Button variant="primary" 
                                size="lg" 
                                disabled={this.props.newListIndex <= 1}
                                onClick={e => this.props.changeNewIndex(this.props.newListIndex - 1)}>
                                <MdChevronLeft />
                            </Button>
                            <HanziList chars={this.props.newChars} size={Math.max(50, this.props.optimalCharSize / 10)} className="mb-2"/>
                            <Button variant="primary" 
                                size="lg" 
                                onClick={e => this.props.changeNewIndex(this.props.newListIndex + 1)}>
                                <MdChevronRight />
                            </Button>
                        </ButtonGroup>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <center>
                            <h1>今日复习</h1>
                        </center>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <HanziList chars={this.props.reviewChars} size={Math.max(50, this.props.optimalCharSize / 10)}/>
                    </Col>
                </Row>

                <Row className="mt-1">
                    <Col>
                        <ButtonGroup className="d-flex">
                            <Button variant="primary" size="lg" onClick={this.props.startRecognise.bind(this)}>
                                <MdDone/>
                                 开始测试
                            </Button>
                        </ButtonGroup>
                        {/*SpeechKITT && SpeechKITT.vroom()*/}
                    </Col>
                </Row>

                <Row className="mt-1">
                    <Col>
                        <ListGroup>
                        {this.recentRecogniseHistory().map((r, i) => (
                            <ListGroup.Item key={i} as={RecogniseHistoryItem} {...r}/>
                        ))}
                        </ListGroup>
                    </Col>
                </Row>
            </Container>
        )
    }
}

class TestView extends React.Component {
    _isMounted = false

    constructor(props){
        super(props)
        this.state = {
            judging: false,
            passedChars: [],
            fullView: false
        }
    }

    componentDidMount(){
        this._isMounted = true
        this.setState({judging: false, passedChars: []})
        if(annyang) {
            const tryHanzi = (hanzi) => {
                let candidates = pinyin(hanzi, {heteronym: true}).shift()
                console.log("candidates", candidates)
                let correct = pinyin(this.props.quizQueue[0], {heteronym: true}).shift()
                console.log("correct", correct)
                let same = correct.filter(x => new Set(candidates).has(x))
                console.log("same", same)
                if (same.length > 0) {
                    console.log('yes')
                    this.recognise(true)
                } else {
                    console.log('no')
                    this.recognise(false)
                }
                console.log('汉字' + hanzi)
            }
            const dontKnow = this.recognise.bind(this, false)
            var commands = {
                '不认识': dontKnow,
                '不知道': dontKnow,
                '我不认识': dontKnow,
                '我不知道': dontKnow,
                '这个字是*hanzi': tryHanzi,
                '这个字念*hanzi': tryHanzi,
            }
            annyang.addCommands(commands, true)
        }
    }
    componentWillUnmount() {
        if (annyang){
            annyang.abort()
        }
        this._isMounted = false
    }
    recognise(correct) {
        this.setState({judging: true})
        const response = correct ? '答对了!' + this.randomCompliments() : this.randomEncouragement() + '，这个字念' + this.props.quizQueue[0]

        speak(response).then(x => {
            if (!this._isMounted) {
                return
            }
            this.setState({judging: false})
            if (this.props.quizQueue.length > 0) {
                this.props.recognise(this.props.quizQueue[0], correct)
                if (correct) {
                    this.setState({passedChars: [...this.state.passedChars, this.props.quizQueue[0]]})
                }
            }
        })
    }

    toggleFullView(){
        this.props.setFullView(!this.state.fullView)
        this.setState({fullView: !this.state.fullView})
    }
    randomOf(list){
        return list[Math.floor(Math.random() * list.length)]
    }

    randomCompliments() {
        return this.props.settings.complimentsEnabled ? this.randomOf(this.props.settings.compliments) : ''
    }

    randomEncouragement() {
        return this.props.settings.encouragementEnabled ? this.randomOf(this.props.settings.encouragement) : ''
    }

    play() {
        if (this.props.quizQueue.length > 0){
            const theChar = this.props.quizQueue[0]
            let toSpeak = this.props.settings.wordsEnabled ? descriptiveWords(theChar) : theChar
            console.log(toSpeak)
            speak(toSpeak)
        }
    }

    progress(key) {
        let totalChar = new Set(this.props.newChars.concat(this.props.reviewChars))
        let total = totalChar.size
        let quizQueue = new Set(this.props.quizQueue)
        return [{
            variant: "",
            now: 100 * (total - quizQueue.size) / total,
            label: `${total - quizQueue.size}/${total}`,
        }, {
            variant: "success",
            now: 100 * (new Set([...this.state.passedChars].filter(x => quizQueue.has(x))).size) / total,
            label: `${new Set([...this.state.passedChars].filter(x => quizQueue.has(x))).size}`
        },
        {
            variant: "warning",
            now: 100 * this.props.wrongChars.length / total,
            label: `${this.props.wrongChars.length}`
        }]
    }
    render() {
        return (
            <Container fluid>
                {this.state.fullView ? null : (
                <>
                    <Row className="mt-1" >
                        <Col>
                            <RecogniseProgressBar progress={this.progress.bind(this)}/>
                        </Col>
                    </Row>
                    <Row className="mt-1">
                        <Col>
                            <VoiceText text='请认一认，这个是什么字啊' autoSpeak={false}/>
                        </Col>
                    </Row>
                </>
                )}
                <Row className="mt-1">
                    <Col>
                        <Container>
                            <Hanzi replay={0}
                                size={this.props.optimalCharSize}
                                char={this.props.quizQueue.length > 0 ? this.props.quizQueue[0] : null} 
                                showPinyin={false}/>
                        </Container>
                    </Col>
                </Row>
                <Row className="mt-1">
                    <Col>
                        <ButtonGroup className="d-flex">
                            <Button variant="success" size="lg" onClick={this.recognise.bind(this, true)} disabled={this.state.judging}>
                                <MdDone/>
                            </Button>
                            {window.speechSynthesis && typeof window.speechSynthesis.speak === "function" ? (
                            <Button variant="primary" size="lg" onClick={this.play.bind(this)}>
                                <GiSpeaker/>
                            </Button>
                            ) : null}
                            <Button variant="outline-warning" size="lg" onClick={this.toggleFullView.bind(this)}>
                                {this.state.fullView ? (
                                    <MdFullscreenExit/>
                                ): (
                                    <MdFullscreen/>
                                )}
                            </Button>
                            <Button variant="danger" size="lg" onClick={this.recognise.bind(this, false)} disabled={this.state.judging}>
                                <MdClose/>
                            </Button>
                        </ButtonGroup>
                        {/*SpeechKITT && SpeechKITT.vroom()*/}
                    </Col>
                </Row>

                <Modal
                    size="sm"
                    show={this.props.quizQueue.length === 0} 
                    onHide={this.props.changeNewIndex.bind(this)}>

                    <Modal.Header closeButton>
                    <Modal.Title>
                        <VoiceText text="恭喜你！完成了！" autoSpeak={true}/>
                    </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <GiUnicorn size={this.props.optimalCharSize/2 || 32}/>
                    </Modal.Body>
                </Modal>
            </Container>
        )
    }
}


class RecognisePage extends React.Component {
    _isMounted = false

    constructor(props){
        super(props)
        this.state = {
            begin: false
        }
    }

    changeNewIndex(index = this.props.newListIndex) {
        this.setState({begin: false})
        this.props.changeNew(index)

        this.props.prepareRecognise(
            ['L' + index],
            [-29, -14, -7, -3, -1].map(d => index + d).filter(i => i >= 0)
                .map(i => 'L' + i.toString())
            );
    }

    componentDidMount() {
        this._isMounted = true
        this.setState({begin: false})
        this.props.prepareRecognise(
            ['L' + this.props.newListIndex],
            [-29, -14, -7, -3, -1].map(d => this.props.newListIndex + d).filter(i => i >= 0)
                .map(i => 'L' + i.toString())
            );
        if (annyang) {
            console.log('initialize annyang')
            var commands = {
                '前': (e) => {
                    this.changeNewIndex(this.props.newListIndex - 1)
                },
                '后': (e) => {
                    this.changeNewIndex(this.props.newListIndex + 1)
                },
                '开始测试': this.startRecognise.bind(this)
            }
            //SpeechKITT.setInstructionsText('准备好')
            //SpeechKITT.setSampleCommands(Object.keys(commands))
            annyang.addCommands(commands)
            annyang.start()
        }
    }

    componentDidUpdate(prevProps, prevState, snapShot) {
    }

    componentWillUnmount() {
        if (annyang){
            annyang.abort()
        }
        this._isMounted = false
    }

    startRecognise() {
        this.setState({begin: true, judging: false})
        this.props.startRecognise()
    }


    render() {
        if (this.state.begin) {
            return (<TestView {...this.props}
                changeNewIndex={this.changeNewIndex.bind(this)}
            />)
        } else {
            return (<SelectView {...this.props} 
                startRecognise={this.startRecognise.bind(this)}
                changeNewIndex={this.changeNewIndex.bind(this)}
                />)
        }
    }
}

RecognisePage.defaultProps = {
    quizQueue: []
}

export default connect(
    state => ({
        newChars: getNewCharList(state),
        reviewChars: getReviewCharList(state),
        quizQueue: getQuizCharQueue(state),
        newListIndex: getNewListIndex(state),
        wrongChars: getWrongChars(state),
        recogniseHistory: getRecogniseHistory(state),
        settings: getSettings(state)
    }),
    {
        prepareRecognise,
        startRecognise, 
        recognise,
        changeNew
    } )(RecognisePage);
