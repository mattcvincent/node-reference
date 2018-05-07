
const proxyquire = require('proxyquire');

describe('products', function () {

    describe('updateProduct', function () {
        beforeEach(function () {
            this.context = {
                params: {
                    id: 'abc'
                },
                request: {
                    body: [
                        {op: 'replace', path: '/name', value: 'new name'}
                    ]
                }
            };
            this.getResponse = {
                Item: {
                    lastModified: '2018-01-02T03:04:05.000Z'
                }
            };
            this.documentClient = {
                get: () => ({
                    promise: () => Promise.resolve(this.getResponse)
                }),
                put: () => ({
                    promise: () => Promise.resolve()
                })
            };
            spyOn(this.documentClient, 'get').and.callThrough();
            spyOn(this.documentClient, 'put').and.callThrough();

            this.validateProduct = (product) => undefined;
            spyOn(this, 'validateProduct').and.callThrough();

            this.updateProduct = proxyquire('./updateProduct', {
                "./documentClient": this.documentClient,
                './validateProduct': this.validateProduct                
            });
        });

        it('should use the correct parameters to get the current state of the product', async function() {
            await this.updateProduct(this.context);
            const expectedParams = {
                TableName: 'Products',
                Segment: undefined,
                Key: {
                    id: 'abc'
                }
            };
            expect(this.documentClient.get.calls.argsFor(0)[0]).toEqual(expectedParams);
        });

        it('should validate the patched product', async function () {
            this.context.request.body = [
                {op: 'replace', path: '/name', value: 'new name'}
            ];
            await this.updateProduct(this.context);
            expect(this.validateProduct.calls.argsFor(0)[0].name).toEqual('new name')            
        });

        it('should pass the tablename to save the document', async function() {
            await this.updateProduct(this.context);
            expect(this.documentClient.put.calls.argsFor(0)[0].TableName).toEqual('Products');
        });

        it('should save the patched product', async function () {
            this.context.request.body = [
                {op: 'replace', path: '/name', value: 'new name'}
            ];
            await this.updateProduct(this.context);
            expect(this.documentClient.put.calls.argsFor(0)[0].Item.name).toEqual('new name')            
        });

        it('should set the lastModified timestamp', async function () {
            jasmine.clock.mock
            await this.updateProduct(this.context);
            
        });

        it('should be a conditional update', async function () {
            await this.updateProduct(this.context);
            expect(this.documentClient.put.calls.argsFor(0)[0].ConditionExpression).toEqual('lastModified = :lastModified');
        });

        it('should provide lastModifed as the condition', async function () {
            await this.updateProduct(this.context);
            const expectedValues = {
                ':lastModified': '2018-01-02T03:04:05.000Z'
            }
            expect(this.documentClient.put.calls.argsFor(0)[0].ExpressionAttributeValues).toEqual(expectedValues);
        });

        it('should return a 400 status code if the patch document is invalid', async function () {
            this.context.request.body[0].op = 'bad';
            await this.updateProduct(this.context);
            expect(this.context.status).toEqual(400);
        });

        describe('validation fails', function () {
            beforeEach(function() {
                this.validationError = {
                    '/name': 'some error'
                };
                this.validateProduct.and.returnValue(this.validationError);
            });

            it('should return a 400 status', async function () {
                await this.updateProduct(this.context);
                expect(this.context.status).toEqual(400);
            });

            it('should return the error as the body', async function () {
                await this.updateProduct(this.context);
                expect(this.context.body).toEqual(this.validationError);
            });

            it('should not save the product', async function () {
                await this.updateProduct(this.context);
                expect(this.documentClient.put).not.toHaveBeenCalled();                
            });
        });

        describe('patch test fails', function () {
            beforeEach(function() {
                this.getResponse.Item.name = 'Apple';
                this.context.request.body = [
                    {op: 'replace', path: '/name', value: 'Grape'},
                    {op: 'test', path: '/name', value: 'Orange'}
                ];
            });

            it('should return a 409 status', async function () {
                await this.updateProduct(this.context);
                expect(this.context.status).toEqual(409);
            });

            it('should not save the product', async function () {
                await this.updateProduct(this.context);
                expect(this.documentClient.put).not.toHaveBeenCalled();                
            });
        });

        it('should return a 409 status if dynamo throws a constraint exception', function () {

        });
    });
});