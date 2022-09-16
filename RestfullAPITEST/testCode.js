const functions = require('firebase-functions');
const util = require('../../../lib/util');
const statusCode = require('../../../constants/statusCode');
const responseMessage = require('../../../constants/responseMessage');
const db = require('../../../db/db');
const { lectureDB, tagDB, skillDB, orderingDB } = require('../../../db');

module.exports = async (req, res) => {
    //비구조화 할당
    const { categoryId, skillId } = req.params;
    let client;
    //data 담을 전역변수선언
    var testresult;
    //ordering 에 필요한 데이터 req.query로 받기
    let { ordering } = req.query;
    //선언되지않을 경우 default로 고정
    if (ordering === undefined) {
        ordering = 'default';
    }
    //ordering 예외처리
    ordering = ordering.toLowerCase();
    if (!['fast', 'slow', 'price', '-price', 'date', 'repeat', '-repeat', 'answer', 'default'].includes(ordering)) {
        return res.status(statusCode.BAD_REQUEST).send(util.fail(statusCode.BAD_REQUEST, responseMessage.OUT_OF_VALUE));
    }
    //클라이언트 DB접속 (DB 쿼리를 상요하기위함)
    client = await db.connect(req);
    try {
        //API 경로에 category_id 와 skill_id 데이터가 담겨있을시 API 실행 
        if (categoryId != '0' && skillId != '0') {
            //DB데이터 ordering
            const order = await orderingDB.getOrder(client, ordering);
            //category_id , skiil_id 를 조건으로 DB데이터조회
            let lectures = await lectureDB.getLectures(client, categoryId, skillId, order);
            //lectures 관련된 Tags 정보가져오기
            const setTagList = async (lectures, idx) => {
                lectures[idx].tags = [lectures[idx].tagName];
                delete lectures[idx].tagName;
                return lectures;
            };
            // Tags data 
            lectures = await setTagList(lectures, 0);
            let i = 1;

            for (; ;) {
                if (lectures[i].id === lectures[i - 1].id) {
                    await lectures[i - 1].tags.push(lectures[i].tagName);
                    await lectures.splice(i, 1);
                } else {
                    lectures = await setTagList(lectures, i);
                    i++;
                }
                if (i === lectures.length) {
                    break;
                }
            }
            lectures.sort((lecture1, lecture2) => {
                if (lecture1.name.toUpperCase < lecture2.name.toUpperCase) {
                    return -1;
                }
                if (lecture1.name.toUpperCase > lecture2.name.toUpperCase) {
                    return 1;
                }
                return 0;
            });
            if (!order.column) {
                lectures.sort((lecture1, lecture2) => -(lecture1.tags.length - lecture2.tags.length));
            }
            res.status(statusCode.OK).send(util.success(statusCode.OK, responseMessage.TEST_CODE_LECTURE_READ, lectures));
        }//categoryid가 0이고 skillid값이 있는경우 Tag들 조회
        else if (categoryId === '0') {
            testresult = await tagDB.getSkillTags(client, skillId);
            res.status(statusCode.OK).send(util.success(statusCode.OK, responseMessage.TEST_CODE_TAG_READ, testresult));
        }//skillid값이 0이고 categoryid가 있는경우 skill들 조회
        else if (skillId === '0') {
            testresult = await skillDB.getSkillsByCategoryId(client, categoryId);
            let i;
            for (i = 0; i < testresult.length; i++) {
                if (testresult[i].name === '기타') {
                    break;
                }
            }
            if (i !== testresult.length) {
                const etcSkill = await testresult.splice(i, 1)[0];
                await testresult.push(etcSkill);
            }
            res.status(statusCode.OK).send(util.success(statusCode.OK, responseMessage.TEST_CODE_SKILL_READ, testresult));
        }
        else if (categoryId === undefined || skillId === undefined) {
            res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, responseMessage.INTERNAL_SERVER_ERROR));
        }
    } catch (error) {
        functions.logger.error(`[ERROR] [${req.method.toUpperCase()}] ${req.originalUrl}`, `[CONTENT] ${error}`);
        console.log(error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send(util.fail(statusCode.INTERNAL_SERVER_ERROR, responseMessage.INTERNAL_SERVER_ERROR));
    } finally {
        client.release();
    }
};